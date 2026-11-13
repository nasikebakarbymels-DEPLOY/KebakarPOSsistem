import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  BluetoothOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  RotateCw,
  Info,
  ChefHat,
  Receipt,
  RefreshCw,
  Trash2,
  Sliders,
  ChevronDown,
  ChevronUp,
  BookOpen,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  printerBleService,
  BLE_PRINTER_STATUS_EVENT,
  SavedPrinterInfo,
  PrinterSetupConfig,
  PaperWidth,
  DEFAULT_SERVICE_UUID,
  DEFAULT_CHAR_UUID,
} from '../../services/printerBleService';
import { Outlet } from '../../types';

interface PengaturanPrinterSegmentProps {
  currentOutlet: Outlet | null;
}

export const PengaturanPrinterSegment: React.FC<PengaturanPrinterSegmentProps> = ({
  currentOutlet,
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Status Printer Struk
  const [isStrukConnected, setIsStrukConnected] = useState<boolean>(false);
  const [strukName, setStrukName] = useState<string | null>(null);
  const [savedStruk, setSavedStruk] = useState<SavedPrinterInfo | null>(null);
  const [connectingStruk, setConnectingStruk] = useState<boolean>(false);
  const [testingStruk, setTestingStruk] = useState<boolean>(false);

  // Status Printer Dapur
  const [isDapurConnected, setIsDapurConnected] = useState<boolean>(false);
  const [dapurName, setDapurName] = useState<string | null>(null);
  const [savedDapur, setSavedDapur] = useState<SavedPrinterInfo | null>(null);
  const [connectingDapur, setConnectingDapur] = useState<boolean>(false);
  const [testingDapur, setTestingDapur] = useState<boolean>(false);

  // Setup & Preferensi Cetak
  const [setupConfig, setSetupConfig] = useState<PrinterSetupConfig>(() =>
    printerBleService.getSetupConfig()
  );

  // Pengaturan UUID & Panduan Setup
  const [showAdvancedSetup, setShowAdvancedSetup] = useState<boolean>(false);
  const [serviceUuid, setServiceUuid] = useState<string>(() =>
    printerBleService.getServiceUuid()
  );
  const [charUuid, setCharUuid] = useState<string>(() => printerBleService.getCharUuid());

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const checkStatus = () => {
    setIsSupported(printerBleService.isSupported());
    setIsStrukConnected(printerBleService.isStrukConnected());
    setStrukName(printerBleService.getConnectedStrukName());
    setSavedStruk(printerBleService.getSavedPrinterStruk());
    setIsDapurConnected(printerBleService.isDapurConnected());
    setDapurName(printerBleService.getConnectedDapurName());
    setSavedDapur(printerBleService.getSavedPrinterDapur());
  };

  useEffect(() => {
    checkStatus();

    // Coba otomatis hubungkan printer tersimpan jika ada izin yang diingat
    printerBleService.connectSavedPrinterStruk().then(checkStatus);
    printerBleService.connectSavedPrinterDapur().then(checkStatus);

    const handlePrinterEvent = () => {
      checkStatus();
    };

    window.addEventListener(BLE_PRINTER_STATUS_EVENT, handlePrinterEvent);
    return () => {
      window.removeEventListener(BLE_PRINTER_STATUS_EVENT, handlePrinterEvent);
    };
  }, []);

  // --- Handlers Printer Struk ---
  const handleConnectStruk = async () => {
    setStatusMessage(null);
    setConnectingStruk(true);
    try {
      const res = await printerBleService.pairPrinterStruk();
      setStatusMessage({
        text: `Berhasil terhubung ke Printer Struk "${res.name}".`,
        type: 'success',
      });
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal menghubungkan ke printer struk.',
        type: 'error',
      });
    } finally {
      setConnectingStruk(false);
      checkStatus();
    }
  };

  const handleReconnectStruk = async () => {
    setStatusMessage(null);
    setConnectingStruk(true);
    try {
      const success = await printerBleService.connectSavedPrinterStruk();
      if (success) {
        setStatusMessage({
          text: `Berhasil menyambung ulang ke Printer Struk "${printerBleService.getConnectedStrukName()}".`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'Tidak dapat menyambung otomatis. Pastikan printer menyala lalu klik "Pair Ulang".',
          type: 'info',
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal menyambung ulang Printer Struk.',
        type: 'error',
      });
    } finally {
      setConnectingStruk(false);
      checkStatus();
    }
  };

  const handleDisconnectStruk = () => {
    printerBleService.disconnectStruk();
    setStatusMessage({
      text: 'Koneksi ke Printer Struk telah diputus.',
      type: 'info',
    });
    checkStatus();
  };

  const handleForgetStruk = () => {
    printerBleService.forgetSavedPrinterStruk();
    setStatusMessage({
      text: 'Printer Struk tersimpan telah dihapus.',
      type: 'info',
    });
    checkStatus();
  };

  const handleTestPrintStruk = async () => {
    setStatusMessage(null);
    setTestingStruk(true);
    try {
      await printerBleService.printTestPageStruk(currentOutlet?.nama || 'POS F&B Multi-Outlet');
      setStatusMessage({
        text: 'Uji cetak berhasil dikirim ke Printer Struk!',
        type: 'success',
      });
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal mencetak struk uji coba.',
        type: 'error',
      });
    } finally {
      setTestingStruk(false);
    }
  };

  // --- Handlers Printer Dapur ---
  const handleConnectDapur = async () => {
    setStatusMessage(null);
    setConnectingDapur(true);
    try {
      const res = await printerBleService.pairPrinterDapur();
      setStatusMessage({
        text: `Berhasil terhubung ke Printer Dapur "${res.name}".`,
        type: 'success',
      });
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal menghubungkan ke printer dapur.',
        type: 'error',
      });
    } finally {
      setConnectingDapur(false);
      checkStatus();
    }
  };

  const handleReconnectDapur = async () => {
    setStatusMessage(null);
    setConnectingDapur(true);
    try {
      const success = await printerBleService.connectSavedPrinterDapur();
      if (success) {
        setStatusMessage({
          text: `Berhasil menyambung ulang ke Printer Dapur "${printerBleService.getConnectedDapurName()}".`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'Tidak dapat menyambung otomatis. Pastikan printer dapur menyala lalu klik "Pair Ulang".',
          type: 'info',
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal menyambung ulang Printer Dapur.',
        type: 'error',
      });
    } finally {
      setConnectingDapur(false);
      checkStatus();
    }
  };

  const handleDisconnectDapur = () => {
    printerBleService.disconnectDapur();
    setStatusMessage({
      text: 'Koneksi ke Printer Dapur telah diputus.',
      type: 'info',
    });
    checkStatus();
  };

  const handleForgetDapur = () => {
    printerBleService.forgetSavedPrinterDapur();
    setStatusMessage({
      text: 'Printer Dapur tersimpan telah dihapus.',
      type: 'info',
    });
    checkStatus();
  };

  const handleTestPrintDapur = async () => {
    setStatusMessage(null);
    setTestingDapur(true);
    try {
      await printerBleService.printTestPageDapur(currentOutlet?.nama || 'POS F&B Multi-Outlet');
      setStatusMessage({
        text: 'Tiket uji coba pesanan berhasil dikirim ke Printer Dapur!',
        type: 'success',
      });
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Gagal mencetak tiket dapur uji coba.',
        type: 'error',
      });
    } finally {
      setTestingDapur(false);
    }
  };

  // --- Handlers Setup & Preferensi Cetak ---
  const handleSaveSetupConfig = () => {
    const updated = printerBleService.setSetupConfig(setupConfig);
    setSetupConfig(updated);
    setStatusMessage({
      text: 'Setup & preferensi cetak printer berhasil disimpan.',
      type: 'success',
    });
  };

  const handleResetSetupConfig = () => {
    const reset = printerBleService.resetSetupConfig();
    setSetupConfig(reset);
    setStatusMessage({
      text: 'Setup printer dikembalikan ke pengaturan default.',
      type: 'info',
    });
  };

  const handleSaveUuid = () => {
    printerBleService.setServiceUuid(serviceUuid);
    printerBleService.setCharUuid(charUuid);
    setServiceUuid(printerBleService.getServiceUuid());
    setCharUuid(printerBleService.getCharUuid());
    setStatusMessage({
      text: 'Konfigurasi UUID Bluetooth berhasil disimpan.',
      type: 'success',
    });
  };

  const handleResetUuid = () => {
    printerBleService.resetUuidDefaults();
    setServiceUuid(DEFAULT_SERVICE_UUID);
    setCharUuid(DEFAULT_CHAR_UUID);
    setStatusMessage({
      text: 'Service & Characteristic UUID dikembalikan ke nilai default.',
      type: 'info',
    });
  };

  return (
    <div className="space-y-4">
      {/* Banner Notifikasi Browser jika tidak dukung Bluetooth */}
      {!isSupported && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-extrabold text-amber-950 mb-1">
              Bluetooth Web Tidak Didukung di Browser Ini
            </p>
            <p>
              Browser saat ini tidak menyediakan Web Bluetooth API. Gunakan Google Chrome di
              Android/PC/Mac untuk pairing printer thermal Bluetooth, atau cetak via dialog browser.
            </p>
          </div>
        </div>
      )}

      {/* Pesan Status Notifikasi Aksi */}
      {statusMessage && (
        <div className="space-y-1.5">
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100 shrink-0"
            >
              Tutup
            </button>
          </div>
          {statusMessage.text.includes('kebijakan keamanan') && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium leading-relaxed flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Web Bluetooth tidak dapat diakses di dalam iframe. Buka tautan aplikasi di tab mandiri.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Card 1: Printer Struk (Kasir) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isStrukConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : savedStruk
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-stone-900 text-sm">Printer Struk (Kasir)</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                    isStrukConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : savedStruk
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isStrukConnected
                    ? 'TERHUBUNG'
                    : savedStruk
                    ? 'TERSIMPAN'
                    : 'TERPUTUS'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {isStrukConnected
                  ? strukName || 'Printer Struk Siap'
                  : savedStruk
                  ? `Perangkat tersimpan: ${savedStruk.name} (Terputus)`
                  : `Mencetak struk belanja pelanggan (ESC/POS ${setupConfig.paperWidth})`}
              </p>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            {isStrukConnected ? (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            ) : (
              <span
                className={`inline-flex rounded-full h-3 w-3 ${
                  savedStruk ? 'bg-amber-400' : 'bg-stone-300'
                }`}
              ></span>
            )}
          </div>
        </div>

        {/* Action Buttons Struk */}
        <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
          {!isStrukConnected ? (
            <>
              {savedStruk && (
                <button
                  type="button"
                  onClick={handleReconnectStruk}
                  disabled={connectingStruk || !isSupported}
                  className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isSupported
                      ? 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${connectingStruk ? 'animate-spin' : ''}`} />
                  <span>Sambung Ulang</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleConnectStruk}
                disabled={connectingStruk || !isSupported}
                className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  !isSupported
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : savedStruk
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
                    : 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                }`}
              >
                {connectingStruk ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mencari Printer...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    <span>{savedStruk ? 'Pair Ulang / Ganti' : 'Hubungkan Printer Struk'}</span>
                  </>
                )}
              </button>

              {savedStruk && (
                <button
                  type="button"
                  onClick={handleForgetStruk}
                  className="py-2.5 px-3.5 rounded-2xl font-bold text-xs bg-stone-50 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 hover:border-rose-200 flex items-center justify-center gap-1.5 transition"
                  title="Hapus perangkat tersimpan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Lupakan</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTestPrintStruk}
                disabled={testingStruk}
                className="flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center gap-2 transition"
              >
                {testingStruk ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mencetak...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Uji Cetak Struk</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDisconnectStruk}
                className="py-2.5 px-4 rounded-2xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center gap-2 transition"
              >
                <BluetoothOff className="w-4 h-4" />
                <span>Putuskan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card 2: Printer Dapur (Kitchen) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isDapurConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : savedDapur
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-stone-900 text-sm">Printer Dapur (Kitchen)</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                    isDapurConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : savedDapur
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isDapurConnected
                    ? 'TERHUBUNG'
                    : savedDapur
                    ? 'TERSIMPAN'
                    : 'TERPUTUS'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {isDapurConnected
                  ? dapurName || 'Printer Dapur Siap'
                  : savedDapur
                  ? `Perangkat tersimpan: ${savedDapur.name} (Terputus)`
                  : 'Mencetak tiket pesanan & koreksi pesanan dapur otomatis'}
              </p>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            {isDapurConnected ? (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            ) : (
              <span
                className={`inline-flex rounded-full h-3 w-3 ${
                  savedDapur ? 'bg-amber-400' : 'bg-stone-300'
                }`}
              ></span>
            )}
          </div>
        </div>

        {/* Action Buttons Dapur */}
        <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
          {!isDapurConnected ? (
            <>
              {savedDapur && (
                <button
                  type="button"
                  onClick={handleReconnectDapur}
                  disabled={connectingDapur || !isSupported}
                  className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isSupported
                      ? 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${connectingDapur ? 'animate-spin' : ''}`} />
                  <span>Sambung Ulang</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleConnectDapur}
                disabled={connectingDapur || !isSupported}
                className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  !isSupported
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : savedDapur
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
                    : 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                }`}
              >
                {connectingDapur ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mencari Printer...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    <span>{savedDapur ? 'Pair Ulang / Ganti' : 'Hubungkan Printer Dapur'}</span>
                  </>
                )}
              </button>

              {savedDapur && (
                <button
                  type="button"
                  onClick={handleForgetDapur}
                  className="py-2.5 px-3.5 rounded-2xl font-bold text-xs bg-stone-50 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 hover:border-rose-200 flex items-center justify-center gap-1.5 transition"
                  title="Hapus perangkat tersimpan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Lupakan</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTestPrintDapur}
                disabled={testingDapur}
                className="flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center gap-2 transition"
              >
                {testingDapur ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mencetak Tiket...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Uji Cetak Tiket Dapur</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDisconnectDapur}
                className="py-2.5 px-4 rounded-2xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center gap-2 transition"
              >
                <BluetoothOff className="w-4 h-4" />
                <span>Putuskan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card 3: Setup & Preferensi Cetak */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-stone-900 text-sm">Setup & Preferensi Cetak</h3>
            <p className="text-xs text-stone-500">
              Atur lebar kertas thermal, salinan, auto-cetak, dan footer struk
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Ukuran Kertas */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              Ukuran Kertas Thermal
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
              {(['58mm', '80mm'] as PaperWidth[]).map((size) => {
                const active = setupConfig.paperWidth === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSetupConfig((prev) => ({ ...prev, paperWidth: size }))}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                      active
                        ? 'bg-white text-orange-700 shadow-2xs border border-orange-200'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {size === '58mm' ? '58mm (32 kol)' : '80mm (48 kol)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jumlah Salinan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              Jumlah Salinan Struk
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
              {([1, 2] as const).map((count) => {
                const active = setupConfig.copies === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSetupConfig((prev) => ({ ...prev, copies: count }))}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                      active
                        ? 'bg-white text-orange-700 shadow-2xs border border-orange-200'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {count === 1 ? '1x Salinan' : '2x Salinan'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Toggle Opsi Cetak */}
        <div className="space-y-2.5">
          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 cursor-pointer">
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-800">
                Otomatis cetak struk setelah bayar
              </div>
              <div className="text-[11px] text-stone-500">
                Langsung cetak ke printer struk Bluetooth saat transaksi selesai
              </div>
            </div>
            <input
              type="checkbox"
              checked={setupConfig.autoPrintStruk}
              onChange={(e) =>
                setSetupConfig((prev) => ({ ...prev, autoPrintStruk: e.target.checked }))
              }
              className="w-4 h-4 accent-orange-600 rounded shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 cursor-pointer">
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-800">
                Potong kertas otomatis (Auto-Cut)
              </div>
              <div className="text-[11px] text-stone-500">
                Kirim perintah ESC/POS auto-cutter di akhir struk & tiket dapur
              </div>
            </div>
            <input
              type="checkbox"
              checked={setupConfig.autoCut}
              onChange={(e) =>
                setSetupConfig((prev) => ({ ...prev, autoCut: e.target.checked }))
              }
              className="w-4 h-4 accent-orange-600 rounded shrink-0"
            />
          </label>
        </div>

        {/* Catatan Footer Struk */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-stone-700">
            Catatan Footer Struk
          </label>
          <textarea
            rows={2}
            value={setupConfig.footerText}
            onChange={(e) =>
              setSetupConfig((prev) => ({ ...prev, footerText: e.target.value }))
            }
            placeholder="Terima kasih atas kunjungan Anda"
            className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
          <p className="text-[11px] text-stone-500">
            Gunakan baris baru (Enter) untuk menampilkan lebih dari 1 baris ucapan pada bagian bawah struk.
          </p>
        </div>

        {/* Tombol Simpan / Reset Setup */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={handleSaveSetupConfig}
            className="flex-1 py-2.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Setup Printer</span>
          </button>

          <button
            type="button"
            onClick={handleResetSetupConfig}
            className="py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
        </div>
      </div>

      {/* Card 4: Pengaturan UUID Lanjutan & Panduan Setup */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvancedSetup((prev) => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-stone-50/70 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-xs sm:text-sm">
                Setup UUID Bluetooth & Panduan Koneksi
              </h3>
              <p className="text-[11px] text-stone-500">
                Konfigurasi GATT UUID khusus & langkah pairing printer thermal
              </p>
            </div>
          </div>
          {showAdvancedSetup ? (
            <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
          )}
        </button>

        {showAdvancedSetup && (
          <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-stone-100">
            {/* Form UUID */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Service UUID (Default: {DEFAULT_SERVICE_UUID})
                </label>
                <input
                  type="text"
                  value={serviceUuid}
                  onChange={(e) => setServiceUuid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono bg-white text-stone-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Characteristic UUID (Default: {DEFAULT_CHAR_UUID})
                </label>
                <input
                  type="text"
                  value={charUuid}
                  onChange={(e) => setCharUuid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono bg-white text-stone-800"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetUuid}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs transition"
                >
                  Reset Default UUID
                </button>
                <button
                  type="button"
                  onClick={handleSaveUuid}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition"
                >
                  Simpan UUID
                </button>
              </div>
            </div>

            {/* Panduan Setup Printer */}
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2 text-xs text-stone-700">
              <p className="font-extrabold text-stone-900 text-xs">
                Langkah Setup Printer Thermal Bluetooth:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-stone-600">
                <li>
                  Nyalakan printer thermal Bluetooth dan pastikan Bluetooth HP/laptop aktif (jika
                  diminta PIN pairing OS, masukkan <span className="font-bold">0000</span> atau{' '}
                  <span className="font-bold">1234</span>).
                </li>
                <li>
                  Gunakan browser <span className="font-bold">Google Chrome / Edge</span> di Android
                  atau desktop (iOS Safari belum mendukung Web Bluetooth, gunakan cetak browser).
                </li>
                <li>
                  Tekan tombol <span className="font-bold">Hubungkan Printer Struk</span> /{' '}
                  <span className="font-bold">Dapur</span>, pilih nama perangkat printer, lalu tekan{' '}
                  <span className="font-bold">Uji Cetak</span>.
                </li>
                <li>
                  Jika hasil cetak tidak terpotong atau lebar teks kurang pas, sesuaikan{' '}
                  <span className="font-bold">Ukuran Kertas (58mm/80mm)</span> di atas lalu klik{' '}
                  <span className="font-bold">Simpan Setup Printer</span>.
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
