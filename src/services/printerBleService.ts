import { Transaksi, Outlet } from '../types';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

// Keys untuk localStorage
const STORAGE_STRUK_DEVICE_KEY = 'pos_printer_struk';
const STORAGE_DAPUR_DEVICE_KEY = 'pos_printer_dapur';
const LEGACY_STORAGE_DEVICE_KEY = 'pos_printer_device'; // Backward compatibility

const STORAGE_SERVICE_UUID_KEY = 'pos_printer_service_uuid';
const STORAGE_CHAR_UUID_KEY = 'pos_printer_char_uuid';

// Default UUIDs
export const DEFAULT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
export const DEFAULT_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

export const BLE_PRINTER_STATUS_EVENT = 'pos_fnb_ble_printer_status_changed';

// Interface Web Bluetooth API typing
interface BluetoothRemoteGATTCharacteristicWithWrite {
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
}

interface BluetoothRemoteGATTServerExtended {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServerExtended>;
  disconnect: () => void;
  getPrimaryService: (service: string) => Promise<{
    getCharacteristic: (char: string) => Promise<BluetoothRemoteGATTCharacteristicWithWrite>;
    getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicWithWrite[]>;
  }>;
  getPrimaryServices?: () => Promise<
    Array<{
      getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicWithWrite[]>;
    }>
  >;
}

interface BluetoothDeviceExtended {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerExtended;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface SavedPrinterInfo {
  id: string;
  name: string;
}

export interface KitchenTicketPayload {
  label: string;
  tipe: string;
  nomorOrder: string;
  waktu: string;
  items: Array<{
    nama: string;
    qty: number;
    catatan?: string;
  }>;
  catatan?: string;
}

export interface CorrectionTicketPayload extends KitchenTicketPayload {
  alasan: string;
}

class PrinterBleService {
  // Slot Printer Struk (Kasir)
  private strukDevice: BluetoothDeviceExtended | null = null;
  private strukServer: BluetoothRemoteGATTServerExtended | null = null;
  private strukChar: BluetoothRemoteGATTCharacteristicWithWrite | null = null;

  // Slot Printer Dapur
  private dapurDevice: BluetoothDeviceExtended | null = null;
  private dapurServer: BluetoothRemoteGATTServerExtended | null = null;
  private dapurChar: BluetoothRemoteGATTCharacteristicWithWrite | null = null;

  private isConnectingStruk: boolean = false;
  private isConnectingDapur: boolean = false;

  private onStrukGattDisconnected = (): void => {
    this.strukChar = null;
    this.strukServer = null;
    this.emitStatus();
  };

  private onDapurGattDisconnected = (): void => {
    this.dapurChar = null;
    this.dapurServer = null;
    this.emitStatus();
  };

  /**
   * Cek apakah navigator.bluetooth tersedia di browser saat ini
   */
  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as unknown as { bluetooth?: { requestDevice: unknown } }).bluetooth
        ?.requestDevice === 'function'
    );
  }

  public getServiceUuid(): string {
    return localStorage.getItem(STORAGE_SERVICE_UUID_KEY) || DEFAULT_SERVICE_UUID;
  }

  public setServiceUuid(uuid: string): void {
    if (uuid.trim()) {
      localStorage.setItem(STORAGE_SERVICE_UUID_KEY, uuid.trim().toLowerCase());
    } else {
      localStorage.removeItem(STORAGE_SERVICE_UUID_KEY);
    }
  }

  public getCharUuid(): string {
    return localStorage.getItem(STORAGE_CHAR_UUID_KEY) || DEFAULT_CHAR_UUID;
  }

  public setCharUuid(uuid: string): void {
    if (uuid.trim()) {
      localStorage.setItem(STORAGE_CHAR_UUID_KEY, uuid.trim().toLowerCase());
    } else {
      localStorage.removeItem(STORAGE_CHAR_UUID_KEY);
    }
  }

  // --- Saved Printers ---
  public getSavedPrinterStruk(): SavedPrinterInfo | null {
    try {
      const raw =
        localStorage.getItem(STORAGE_STRUK_DEVICE_KEY) ||
        localStorage.getItem(LEGACY_STORAGE_DEVICE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public getSavedPrinterDapur(): SavedPrinterInfo | null {
    try {
      const raw = localStorage.getItem(STORAGE_DAPUR_DEVICE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Backward compatibility alias
  public getSavedPrinter(): SavedPrinterInfo | null {
    return this.getSavedPrinterStruk();
  }

  // --- Connection Status ---
  public isStrukConnected(): boolean {
    return Boolean(
      this.strukDevice &&
        this.strukServer &&
        this.strukServer.connected &&
        this.strukChar
    );
  }

  public isDapurConnected(): boolean {
    return Boolean(
      this.dapurDevice &&
        this.dapurServer &&
        this.dapurServer.connected &&
        this.dapurChar
    );
  }

  // Backward compatibility alias
  public isConnected(): boolean {
    return this.isStrukConnected();
  }

  public getConnectedStrukName(): string | null {
    if (!this.isStrukConnected()) return null;
    return this.strukDevice?.name || this.getSavedPrinterStruk()?.name || 'Printer Struk';
  }

  public getConnectedDapurName(): string | null {
    if (!this.isDapurConnected()) return null;
    return this.dapurDevice?.name || this.getSavedPrinterDapur()?.name || 'Printer Dapur';
  }

  public getConnectedDeviceName(): string | null {
    return this.getConnectedStrukName();
  }

  /**
   * Emit perubahan status ke UI
   */
  public emitStatus(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BLE_PRINTER_STATUS_EVENT, {
          detail: {
            connected: this.isStrukConnected(),
            strukConnected: this.isStrukConnected(),
            dapurConnected: this.isDapurConnected(),
            strukName: this.getConnectedStrukName(),
            dapurName: this.getConnectedDapurName(),
            deviceName: this.getConnectedStrukName(),
            savedStruk: this.getSavedPrinterStruk(),
            savedDapur: this.getSavedPrinterDapur(),
          },
        })
      );
    }
  }

  /**
   * Koneksi instance ke GATT Server & Characteristic
   */
  private async connectDeviceInstance(
    dev: BluetoothDeviceExtended,
    disconnectListener: () => void
  ): Promise<{
    server: BluetoothRemoteGATTServerExtended;
    characteristic: BluetoothRemoteGATTCharacteristicWithWrite;
  }> {
    if (!dev.gatt) {
      throw new Error('Perangkat Bluetooth tidak memiliki layanan GATT.');
    }

    dev.removeEventListener?.('gattserverdisconnected', disconnectListener);
    dev.addEventListener('gattserverdisconnected', disconnectListener);

    const server = await dev.gatt.connect();
    const serviceUuid = this.getServiceUuid();
    const charUuid = this.getCharUuid();

    let writeChar: BluetoothRemoteGATTCharacteristicWithWrite | null = null;

    // 1. Coba service dan char spesifik
    try {
      const primaryService = await server.getPrimaryService(serviceUuid);
      try {
        writeChar = await primaryService.getCharacteristic(charUuid);
      } catch {
        const chars = await primaryService.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
      }
    } catch {
      // Fallback
    }

    // 2. Scan fallback services jika belum ditemukan
    if (!writeChar) {
      const fallbackServices = [
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb',
        DEFAULT_SERVICE_UUID,
      ];
      for (const sUuid of fallbackServices) {
        try {
          const s = await server.getPrimaryService(sUuid);
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch {
          // lanjut
        }
      }
    }

    if (!writeChar) {
      throw new Error(
        'Printer tersambung tetapi saluran data cetak (write characteristic) tidak ditemukan. Pastikan mode ESC/POS aktif.'
      );
    }

    return { server, characteristic: writeChar };
  }

  // ================= PRINTER STRUK =================

  public async pairPrinterStruk(): Promise<{ success: boolean; name: string }> {
    if (!this.isSupported()) {
      throw new Error('Perangkat atau browser ini tidak mendukung Web Bluetooth API.');
    }

    try {
      this.disconnectStruk();
      const serviceUuid = this.getServiceUuid();

      const navBle = (navigator as unknown as {
        bluetooth: {
          requestDevice: (opt: unknown) => Promise<BluetoothDeviceExtended>;
        };
      }).bluetooth;

      const selectedDevice = await navBle.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          serviceUuid,
          DEFAULT_SERVICE_UUID,
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!selectedDevice) {
        throw new Error('Tidak ada printer yang dipilih.');
      }

      const printerName = selectedDevice.name || 'Printer Struk';
      const printerInfo: SavedPrinterInfo = {
        id: selectedDevice.id,
        name: printerName,
      };

      localStorage.setItem(STORAGE_STRUK_DEVICE_KEY, JSON.stringify(printerInfo));
      localStorage.setItem(LEGACY_STORAGE_DEVICE_KEY, JSON.stringify(printerInfo));

      const { server, characteristic } = await this.connectDeviceInstance(
        selectedDevice,
        this.onStrukGattDisconnected
      );

      this.strukDevice = selectedDevice;
      this.strukServer = server;
      this.strukChar = characteristic;

      this.emitStatus();
      return { success: true, name: printerName };
    } catch (err: unknown) {
      this.emitStatus();
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          throw new Error('Pemasangan printer dibatalkan.');
        }
        if (err.name === 'SecurityError') {
          throw new Error(
            'Akses Bluetooth diblokir oleh kebijakan keamanan browser. Buka aplikasi di tab terpisah, lalu coba lagi.'
          );
        }
        throw err;
      }
      throw new Error('Gagal menghubungkan ke printer Bluetooth.');
    }
  }

  // Alias backward compatibility
  public async pairPrinter(): Promise<{ success: boolean; name: string }> {
    return this.pairPrinterStruk();
  }

  public async connectSavedPrinterStruk(): Promise<boolean> {
    if (!this.isSupported() || this.isConnectingStruk) return false;
    if (this.isStrukConnected()) return true;

    const saved = this.getSavedPrinterStruk();
    if (!saved?.id) return false;

    this.isConnectingStruk = true;

    try {
      const navBle = (navigator as unknown as {
        bluetooth: {
          getDevices?: () => Promise<BluetoothDeviceExtended[]>;
        };
      }).bluetooth;

      if (typeof navBle.getDevices !== 'function') {
        this.isConnectingStruk = false;
        return false;
      }

      const devices = await navBle.getDevices();
      const matched = devices.find((d) => d.id === saved.id);

      if (!matched) {
        this.isConnectingStruk = false;
        return false;
      }

      const { server, characteristic } = await this.connectDeviceInstance(
        matched,
        this.onStrukGattDisconnected
      );

      this.strukDevice = matched;
      this.strukServer = server;
      this.strukChar = characteristic;

      this.emitStatus();
      return true;
    } catch (err) {
      console.warn('[printerBleService] Gagal menyambung ke printer struk tersimpan:', err);
      return false;
    } finally {
      this.isConnectingStruk = false;
    }
  }

  // Alias backward compatibility
  public async connectSavedPrinter(): Promise<boolean> {
    return this.connectSavedPrinterStruk();
  }

  public disconnectStruk(): void {
    try {
      if (this.strukDevice) {
        this.strukDevice.removeEventListener?.('gattserverdisconnected', this.onStrukGattDisconnected);
      }
      if (this.strukDevice?.gatt?.connected) {
        this.strukDevice.gatt.disconnect();
      }
    } catch {
      // Abaikan
    } finally {
      this.strukDevice = null;
      this.strukServer = null;
      this.strukChar = null;
      this.emitStatus();
    }
  }

  // Alias backward compatibility
  public disconnect(): void {
    this.disconnectStruk();
  }

  public forgetSavedPrinterStruk(): void {
    this.disconnectStruk();
    localStorage.removeItem(STORAGE_STRUK_DEVICE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_DEVICE_KEY);
    this.emitStatus();
  }

  public forgetSavedPrinter(): void {
    this.forgetSavedPrinterStruk();
  }

  // ================= PRINTER DAPUR =================

  public async pairPrinterDapur(): Promise<{ success: boolean; name: string }> {
    if (!this.isSupported()) {
      throw new Error('Perangkat atau browser ini tidak mendukung Web Bluetooth API.');
    }

    try {
      this.disconnectDapur();
      const serviceUuid = this.getServiceUuid();

      const navBle = (navigator as unknown as {
        bluetooth: {
          requestDevice: (opt: unknown) => Promise<BluetoothDeviceExtended>;
        };
      }).bluetooth;

      const selectedDevice = await navBle.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          serviceUuid,
          DEFAULT_SERVICE_UUID,
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!selectedDevice) {
        throw new Error('Tidak ada printer yang dipilih.');
      }

      const printerName = selectedDevice.name || 'Printer Dapur';
      const printerInfo: SavedPrinterInfo = {
        id: selectedDevice.id,
        name: printerName,
      };

      localStorage.setItem(STORAGE_DAPUR_DEVICE_KEY, JSON.stringify(printerInfo));

      const { server, characteristic } = await this.connectDeviceInstance(
        selectedDevice,
        this.onDapurGattDisconnected
      );

      this.dapurDevice = selectedDevice;
      this.dapurServer = server;
      this.dapurChar = characteristic;

      this.emitStatus();
      return { success: true, name: printerName };
    } catch (err: unknown) {
      this.emitStatus();
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          throw new Error('Pemasangan printer dibatalkan.');
        }
        if (err.name === 'SecurityError') {
          throw new Error(
            'Akses Bluetooth diblokir oleh kebijakan keamanan browser. Buka aplikasi di tab terpisah, lalu coba lagi.'
          );
        }
        throw err;
      }
      throw new Error('Gagal menghubungkan ke printer Dapur.');
    }
  }

  public async connectSavedPrinterDapur(): Promise<boolean> {
    if (!this.isSupported() || this.isConnectingDapur) return false;
    if (this.isDapurConnected()) return true;

    const saved = this.getSavedPrinterDapur();
    if (!saved?.id) return false;

    this.isConnectingDapur = true;

    try {
      const navBle = (navigator as unknown as {
        bluetooth: {
          getDevices?: () => Promise<BluetoothDeviceExtended[]>;
        };
      }).bluetooth;

      if (typeof navBle.getDevices !== 'function') {
        this.isConnectingDapur = false;
        return false;
      }

      const devices = await navBle.getDevices();
      const matched = devices.find((d) => d.id === saved.id);

      if (!matched) {
        this.isConnectingDapur = false;
        return false;
      }

      const { server, characteristic } = await this.connectDeviceInstance(
        matched,
        this.onDapurGattDisconnected
      );

      this.dapurDevice = matched;
      this.dapurServer = server;
      this.dapurChar = characteristic;

      this.emitStatus();
      return true;
    } catch (err) {
      console.warn('[printerBleService] Gagal menyambung ke printer dapur tersimpan:', err);
      return false;
    } finally {
      this.isConnectingDapur = false;
    }
  }

  public disconnectDapur(): void {
    try {
      if (this.dapurDevice) {
        this.dapurDevice.removeEventListener?.('gattserverdisconnected', this.onDapurGattDisconnected);
      }
      if (this.dapurDevice?.gatt?.connected) {
        this.dapurDevice.gatt.disconnect();
      }
    } catch {
      // Abaikan
    } finally {
      this.dapurDevice = null;
      this.dapurServer = null;
      this.dapurChar = null;
      this.emitStatus();
    }
  }

  public forgetSavedPrinterDapur(): void {
    this.disconnectDapur();
    localStorage.removeItem(STORAGE_DAPUR_DEVICE_KEY);
    this.emitStatus();
  }

  public disconnectAll(): void {
    this.disconnectStruk();
    this.disconnectDapur();
  }

  // ================= PENGIRIMAN DATA ESC/POS =================

  private async sendBytesToChar(
    char: BluetoothRemoteGATTCharacteristicWithWrite,
    bytes: Uint8Array
  ): Promise<void> {
    const CHUNK_SIZE = 180;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (char.writeValueWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
        await new Promise((resolve) => setTimeout(resolve, 30));
      } else if (char.writeValueWithResponse) {
        await char.writeValueWithResponse(chunk);
      } else if (char.writeValue) {
        await char.writeValue(chunk);
      }
    }
  }

  public async printStrukEscPos(bytes: Uint8Array): Promise<void> {
    if (!this.isStrukConnected() || !this.strukChar) {
      throw new Error('Printer Struk belum terhubung.');
    }
    await this.sendBytesToChar(this.strukChar, bytes);
  }

  public async printDapurEscPos(bytes: Uint8Array): Promise<void> {
    if (!this.isDapurConnected() || !this.dapurChar) {
      throw new Error('Printer Dapur belum terhubung.');
    }
    await this.sendBytesToChar(this.dapurChar, bytes);
  }

  /**
   * Fallback cetak via browser window.print jika BLE tidak tersambung
   */
  private triggerBrowserFallbackPrint(title: string, bodyText: string): void {
    if (typeof window === 'undefined') return;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: monospace; font-size: 13px; padding: 12px; margin: 0; max-width: 58mm; white-space: pre-wrap; }
            h2 { font-size: 15px; margin: 0 0 6px 0; text-align: center; }
            hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          </style>
        </head>
        <body>${bodyText}</body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 250);
  }

  // ================= TIKET DAPUR & KOREKSI =================

  /**
   * 3. printKitchenTicket(payload)
   * Format ESC/POS ringkas.
   * Rute ke printer dapur bila terhubung, bila tidak fallback ke printer struk,
   * bila tidak ada keduanya fallback window.print.
   */
  public async printKitchenTicket(payload: KitchenTicketPayload): Promise<void> {
    const builder = new EscPosBuilder();
    builder.init();
    builder.alignCenter();
    builder.setBold(true);
    builder.textLine('=== TIKET PESANAN DAPUR ===');
    builder.setBold(false);
    builder.textLine(`Tipe : ${payload.tipe.toUpperCase()}`);
    builder.setBold(true);
    builder.textLine(`[ ${payload.label} ]`);
    builder.setBold(false);
    builder.textLine(`No Order : ${payload.nomorOrder}`);
    builder.textLine(`Waktu    : ${formatDateTimeIndo(payload.waktu)}`);
    builder.textLine('--------------------------------');

    builder.alignLeft();
    for (const item of payload.items) {
      builder.setBold(true);
      builder.textLine(`${item.qty}x ${item.nama}`);
      builder.setBold(false);
      if (item.catatan?.trim()) {
        builder.textLine(`   Catatan: ${item.catatan.trim()}`);
      }
    }

    if (payload.catatan?.trim()) {
      builder.textLine('--------------------------------');
      builder.textLine(`Catatan Order: ${payload.catatan.trim()}`);
    }

    builder.textLine('================================');
    builder.feed(3);
    builder.cut();

    const bytes = builder.build();

    // Routing: Dapur -> Struk -> Browser
    if (this.isDapurConnected() && this.dapurChar) {
      try {
        await this.sendBytesToChar(this.dapurChar, bytes);
        return;
      } catch (err) {
        console.warn('[printerBleService] Gagal ke printer dapur, mencoba ke printer struk:', err);
      }
    }

    if (this.isStrukConnected() && this.strukChar) {
      try {
        await this.sendBytesToChar(this.strukChar, bytes);
        return;
      } catch (err) {
        console.warn('[printerBleService] Gagal ke printer struk fallback:', err);
      }
    }

    // Fallback terakhir: Browser print dialog
    const itemsText = payload.items
      .map((it) => `${it.qty}x ${it.nama}${it.catatan ? `\n   * ${it.catatan}` : ''}`)
      .join('\n');
    const textHtml = `
      <h2>=== TIKET DAPUR ===</h2>
      <div><strong>[ ${payload.label} ]</strong></div>
      <div>Tipe: ${payload.tipe.toUpperCase()}</div>
      <div>No Order: ${payload.nomorOrder}</div>
      <div>Waktu: ${formatDateTimeIndo(payload.waktu)}</div>
      <hr />
      <div style="font-weight: bold;">${itemsText.replace(/\n/g, '<br/>')}</div>
      ${payload.catatan ? `<hr /><div>Catatan: ${payload.catatan}</div>` : ''}
      <hr />
    `;
    this.triggerBrowserFallbackPrint(`Tiket Dapur - ${payload.label}`, textHtml);
  }

  /**
   * 4. printCorrectionTicket(payload)
   * Header "KOREKSI PESANAN" + alasan wajib.
   */
  public async printCorrectionTicket(payload: CorrectionTicketPayload): Promise<void> {
    const builder = new EscPosBuilder();
    builder.init();
    builder.alignCenter();
    builder.setBold(true);
    builder.textLine('*** KOREKSI PESANAN DAPUR ***');
    builder.textLine(`[ ${payload.label} ]`);
    builder.setBold(false);
    builder.textLine(`Tipe : ${payload.tipe.toUpperCase()}`);
    builder.textLine(`No Order : ${payload.nomorOrder}`);
    builder.textLine(`Waktu    : ${formatDateTimeIndo(payload.waktu)}`);
    builder.textLine('--------------------------------');

    builder.alignLeft();
    builder.setBold(true);
    builder.textLine('ALASAN KOREKSI:');
    builder.textLine(payload.alasan);
    builder.setBold(false);
    builder.textLine('--------------------------------');

    builder.textLine('DAFTAR ITEM TERBARU:');
    for (const item of payload.items) {
      builder.setBold(true);
      builder.textLine(`${item.qty}x ${item.nama}`);
      builder.setBold(false);
      if (item.catatan?.trim()) {
        builder.textLine(`   Catatan: ${item.catatan.trim()}`);
      }
    }

    if (payload.catatan?.trim()) {
      builder.textLine('--------------------------------');
      builder.textLine(`Catatan Order: ${payload.catatan.trim()}`);
    }

    builder.textLine('================================');
    builder.feed(3);
    builder.cut();

    const bytes = builder.build();

    // Routing: Dapur -> Struk -> Browser
    if (this.isDapurConnected() && this.dapurChar) {
      try {
        await this.sendBytesToChar(this.dapurChar, bytes);
        return;
      } catch (err) {
        console.warn('[printerBleService] Gagal kirim tiket koreksi ke printer dapur, mencoba struk:', err);
      }
    }

    if (this.isStrukConnected() && this.strukChar) {
      try {
        await this.sendBytesToChar(this.strukChar, bytes);
        return;
      } catch (err) {
        console.warn('[printerBleService] Gagal kirim tiket koreksi ke printer struk:', err);
      }
    }

    // Fallback: Browser print dialog
    const itemsText = payload.items
      .map((it) => `${it.qty}x ${it.nama}${it.catatan ? `\n   * ${it.catatan}` : ''}`)
      .join('\n');
    const textHtml = `
      <h2>*** KOREKSI PESANAN ***</h2>
      <div><strong>[ ${payload.label} ]</strong></div>
      <div>Tipe: ${payload.tipe.toUpperCase()}</div>
      <div>No Order: ${payload.nomorOrder}</div>
      <div>Waktu: ${formatDateTimeIndo(payload.waktu)}</div>
      <hr />
      <div style="color: red; font-weight: bold;">ALASAN: ${payload.alasan}</div>
      <hr />
      <div><strong>Daftar Item:</strong></div>
      <div>${itemsText.replace(/\n/g, '<br/>')}</div>
      ${payload.catatan ? `<hr /><div>Catatan: ${payload.catatan}</div>` : ''}
      <hr />
    `;
    this.triggerBrowserFallbackPrint(`Koreksi Dapur - ${payload.label}`, textHtml);
  }

  // ================= UJI CETAK =================

  public async printTestPageStruk(outletNama: string = 'POS F&B Multi-Outlet'): Promise<void> {
    if (!this.isStrukConnected()) {
      throw new Error('Printer Struk belum terhubung. Silakan hubungkan terlebih dahulu.');
    }

    const builder = new EscPosBuilder();
    builder.init();
    builder.alignCenter();
    builder.setBold(true);
    builder.textLine(outletNama);
    builder.setBold(false);
    builder.textLine('UJI KONEKSI PRINTER STRUK');
    builder.textLine('--------------------------------');
    builder.alignLeft();
    builder.textLine('Status    : TERHUBUNG OK');
    builder.textLine(`Perangkat : ${this.getConnectedStrukName()}`);
    builder.textLine(`Waktu     : ${formatDateTimeIndo(new Date().toISOString())}`);
    builder.textLine('--------------------------------');
    builder.alignCenter();
    builder.textLine('Printer struk siap digunakan!');
    builder.feed(3);
    builder.cut();

    await this.printStrukEscPos(builder.build());
  }

  public async printTestPageDapur(outletNama: string = 'POS F&B Multi-Outlet'): Promise<void> {
    if (!this.isDapurConnected()) {
      throw new Error('Printer Dapur belum terhubung. Silakan hubungkan terlebih dahulu.');
    }

    const builder = new EscPosBuilder();
    builder.init();
    builder.alignCenter();
    builder.setBold(true);
    builder.textLine('=== CONTOH TIKET DAPUR ===');
    builder.setBold(false);
    builder.textLine(outletNama);
    builder.textLine('--------------------------------');
    builder.alignLeft();
    builder.textLine('Tipe      : DINE-IN');
    builder.textLine('Label     : Meja 12 (Contoh)');
    builder.textLine(`Perangkat : ${this.getConnectedDapurName()}`);
    builder.textLine(`Waktu     : ${formatDateTimeIndo(new Date().toISOString())}`);
    builder.textLine('--------------------------------');
    builder.setBold(true);
    builder.textLine('2x Nasi Goreng Spesial');
    builder.setBold(false);
    builder.textLine('   * Pedas level 3, telur ceplok');
    builder.setBold(true);
    builder.textLine('1x Es Teh Manis Jumbo');
    builder.setBold(false);
    builder.textLine('   * Kurang manis, es banyak');
    builder.textLine('================================');
    builder.alignCenter();
    builder.textLine('Printer dapur siap digunakan!');
    builder.feed(3);
    builder.cut();

    await this.printDapurEscPos(builder.build());
  }

  public async printTestPage(outletNama: string = 'POS F&B Multi-Outlet'): Promise<void> {
    return this.printTestPageStruk(outletNama);
  }

  // ================= CETAK STRUK TRANSAKSI =================

  public async printTransaksi(transaksi: Transaksi, outlet?: Outlet | null): Promise<void> {
    if (!this.isStrukConnected()) {
      throw new Error('Printer Bluetooth belum terhubung.');
    }

    const builder = new EscPosBuilder();
    builder.init();

    // Header Struk
    builder.alignCenter();
    builder.setBold(true);
    builder.textLine(outlet?.nama || 'POS F&B');
    builder.setBold(false);
    if (outlet?.alamat) {
      builder.textLine(outlet.alamat);
    }
    if (outlet?.telepon) {
      builder.textLine(`Telp: ${outlet.telepon}`);
    }
    builder.textLine('================================');

    // Info Transaksi
    builder.alignLeft();
    builder.textLine(`No  : ${transaksi.nomorTransaksi}`);
    builder.textLine(`Tgl : ${formatDateTimeIndo(transaksi.createdAt)}`);
    builder.textLine(`Ksr : ${transaksi.kasirNama || 'Kasir'}`);
    if (transaksi.pelangganNama) {
      builder.textLine(`Plg : ${transaksi.pelangganNama}`);
    }
    builder.textLine('--------------------------------');

    // Items (Lebar 32 karakter standar 58mm)
    for (const item of transaksi.items) {
      builder.textLine(item.nama);
      const detailStr = `  ${item.qty} x ${formatRupiah(item.hargaJual)}`;
      const subtotalStr = formatRupiah(item.subtotal);
      const spacesNeeded = Math.max(1, 32 - detailStr.length - subtotalStr.length);
      builder.textLine(detailStr + ' '.repeat(spacesNeeded) + subtotalStr);
    }

    builder.textLine('--------------------------------');

    // Helper format baris rata kiri-kanan lebar 32 karakter
    const formatLine32 = (label: string, value: string): string => {
      const maxLabelLen = Math.max(1, 32 - value.length - 1);
      const truncatedLabel = label.length > maxLabelLen ? label.substring(0, maxLabelLen) : label;
      const spaces = Math.max(1, 32 - truncatedLabel.length - value.length);
      return truncatedLabel + ' '.repeat(spaces) + value;
    };

    // Subtotal kotor sebelum diskon
    const subtotalHitung = transaksi.items.reduce((acc, it) => {
      const hargaSatuan = it.hargaAsli ?? it.hargaJual;
      return acc + hargaSatuan * it.qty;
    }, 0);
    const subtotalFinal = transaksi.subtotalKotor || subtotalHitung;
    if (subtotalFinal > 0) {
      builder.textLine(formatLine32('Subtotal', formatRupiah(subtotalFinal)));
    }

    // Diskon Promo jika ada
    if (transaksi.diskonProdukTotal && transaksi.diskonProdukTotal > 0) {
      builder.textLine(formatLine32('Diskon Promo', `-${formatRupiah(transaksi.diskonProdukTotal)}`));
    }

    // Voucher jika ada
    if (transaksi.voucherNilai && transaksi.voucherNilai > 0) {
      const voucherLabel = transaksi.voucherKode ? `Voucher (${transaksi.voucherKode})` : 'Voucher';
      builder.textLine(formatLine32(voucherLabel, `-${formatRupiah(transaksi.voucherNilai)}`));
    }

    // Rincian Biaya Lain jika ada
    if (transaksi.biayaLainList && transaksi.biayaLainList.length > 0) {
      for (const biaya of transaksi.biayaLainList) {
        const namaBiaya = `${biaya.nama}${biaya.isManual ? '*' : ''}`;
        builder.textLine(formatLine32(namaBiaya, formatRupiah(biaya.subtotal)));
      }
    }

    // Catatan Approval Biaya Manual jika ada
    if (transaksi.approvalBiayaManual && transaksi.approvalBiayaManual.length > 0) {
      builder.textLine('* Biaya manual diverifikasi');
      builder.textLine('  PIN Owner');
    }

    builder.textLine('--------------------------------');

    // Total & Pembayaran
    const totalLabel = 'TOTAL';
    const totalVal = formatRupiah(transaksi.total);
    const totalSpaces = Math.max(1, 32 - totalLabel.length - totalVal.length);
    builder.setBold(true);
    builder.textLine(totalLabel + ' '.repeat(totalSpaces) + totalVal);
    builder.setBold(false);

    const metodeLabel = `Bayar (${transaksi.metodeBayar.toUpperCase()})`;
    builder.textLine(metodeLabel);

    if (transaksi.metodeBayar === 'tunai' && transaksi.uangDiterima !== undefined) {
      const uangDiterimaStr = formatRupiah(transaksi.uangDiterima);
      const tunaiSpaces = Math.max(1, 32 - '  Diterima'.length - uangDiterimaStr.length);
      builder.textLine('  Diterima' + ' '.repeat(tunaiSpaces) + uangDiterimaStr);

      const kembalianStr = formatRupiah(transaksi.kembalian || 0);
      const kembalianSpaces = Math.max(1, 32 - '  Kembalian'.length - kembalianStr.length);
      builder.textLine('  Kembalian' + ' '.repeat(kembalianSpaces) + kembalianStr);
    }

    builder.textLine('================================');
    builder.alignCenter();
    builder.textLine('Terima kasih atas kunjungan Anda');
    builder.textLine('Barang yang dibeli tidak dapat ditukar');
    builder.feed(3);
    builder.cut();

    await this.printStrukEscPos(builder.build());
  }
}

/**
 * Helper class untuk membuat ESC/POS byte sequence
 */
export class EscPosBuilder {
  private buffer: number[] = [];
  private encoder: TextEncoder = new TextEncoder();

  public init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  public alignLeft(): this {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter(): this {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight(): this {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  public setBold(enabled: boolean): this {
    this.buffer.push(0x1b, 0x45, enabled ? 0x01 : 0x00);
    return this;
  }

  public text(str: string): this {
    const encoded = this.encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.buffer.push(encoded[i]);
    }
    return this;
  }

  public textLine(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  public feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  public cut(): this {
    this.buffer.push(0x1d, 0x56, 0x00);
    return this;
  }

  public build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export const printerBleService = new PrinterBleService();
