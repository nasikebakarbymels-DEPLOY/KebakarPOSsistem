import React, { useState, useEffect } from 'react';
import {
  Printer,
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
} from 'lucide-react';
import {
  printerBleService,
  BLE_PRINTER_STATUS_EVENT,
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
  const [connectingStruk, setConnectingStruk] = useState<boolean>(false);
  const [testingStruk, setTestingStruk] = useState<boolean>(false);

  // Status Printer Dapur
  const [isDapurConnected, setIsDapurConnected] = useState<boolean>(false);
  const [dapurName, setDapurName] = useState<string | null>(null);
  const [connectingDapur, setConnectingDapur] = useState<boolean>(false);
  const [testingDapur, setTestingDapur] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const checkStatus = () => {
    setIsSupported(printerBleService.isSupported());
    setIsStrukConnected(printerBleService.isStrukConnected());
    setStrukName(printerBleService.getConnectedStrukName());
    setIsDapurConnected(printerBleService.isDapurConnected());
    setDapurName(printerBleService.getConnectedDapurName());
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

  const handleDisconnectStruk = () => {
    printerBleService.disconnectStruk();
    setStatusMessage({
      text: 'Koneksi ke Printer Struk telah diputus.',
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

  const handleDisconnectDapur = () => {
    printerBleService.disconnectDapur();
    setStatusMessage({
      text: 'Koneksi ke Printer Dapur telah diputus.',
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
              Browser saat ini tidak menyediakan Web Bluetooth API. Gunakan browser Chromium
              (Google Chrome di Android/PC/Mac) untuk pairing printer thermal Bluetooth.
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
              className="text-[11px] underline opacity-80 hover:opacity-100"
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
      <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isStrukConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-900 text-sm">Printer Struk (Kasir)</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                    isStrukConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isStrukConnected ? 'TERHUBUNG' : 'TERPUTUS'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {isStrukConnected
                  ? strukName || 'Printer Struk Siap'
                  : 'Mencetak struk belanja transaksi pelanggan (ESC/POS 58mm)'}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            {isStrukConnected ? (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-3 w-3 bg-stone-300"></span>
            )}
          </div>
        </div>

        {/* Action Buttons Struk */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {!isStrukConnected ? (
            <button
              type="button"
              onClick={handleConnectStruk}
              disabled={connectingStruk || !isSupported}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isSupported
                  ? 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {connectingStruk ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Mencari Printer Struk...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4" />
                  <span>Hubungkan Printer Struk</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTestPrintStruk}
                disabled={testingStruk}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center gap-2 transition"
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
                className="py-3 px-4 rounded-2xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center gap-2 transition"
              >
                <BluetoothOff className="w-4 h-4" />
                <span>Putuskan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card 2: Printer Dapur (Kitchen) */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isDapurConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-900 text-sm">Printer Dapur (Kitchen)</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                    isDapurConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isDapurConnected ? 'TERHUBUNG' : 'TERPUTUS'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {isDapurConnected
                  ? dapurName || 'Printer Dapur Siap'
                  : 'Mencetak tiket pesanan dapur dan tiket koreksi pesanan otomatis'}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            {isDapurConnected ? (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-3 w-3 bg-stone-300"></span>
            )}
          </div>
        </div>

        {/* Action Buttons Dapur */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {!isDapurConnected ? (
            <button
              type="button"
              onClick={handleConnectDapur}
              disabled={connectingDapur || !isSupported}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isSupported
                  ? 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white shadow-sm'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {connectingDapur ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Mencari Printer Dapur...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4" />
                  <span>Hubungkan Printer Dapur</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTestPrintDapur}
                disabled={testingDapur}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center gap-2 transition"
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
                className="py-3 px-4 rounded-2xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center gap-2 transition"
              >
                <BluetoothOff className="w-4 h-4" />
                <span>Putuskan</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
