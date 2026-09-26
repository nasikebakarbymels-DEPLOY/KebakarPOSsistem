import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Sliders,
  FileText,
  Unplug,
} from 'lucide-react';
import { printerBleService, BLE_PRINTER_STATUS_EVENT } from '../../services/printerBleService';
import { useAuth } from '../../context/AuthContext';

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentOutlet } = useAuth();
  const isSupported = printerBleService.isSupported();

  const [isConnected, setIsConnected] = useState<boolean>(printerBleService.isConnected());
  const [deviceName, setDeviceName] = useState<string | null>(
    printerBleService.getConnectedDeviceName()
  );
  const [savedDevice, setSavedDevice] = useState(printerBleService.getSavedPrinter());

  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [serviceUuid, setServiceUuid] = useState(printerBleService.getServiceUuid());
  const [charUuid, setCharUuid] = useState(printerBleService.getCharUuid());

  const [feedback, setFeedback] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    const handleStatus = () => {
      setIsConnected(printerBleService.isConnected());
      setDeviceName(printerBleService.getConnectedDeviceName());
      setSavedDevice(printerBleService.getSavedPrinter());
    };

    window.addEventListener(BLE_PRINTER_STATUS_EVENT, handleStatus);
    handleStatus();

    return () => {
      window.removeEventListener(BLE_PRINTER_STATUS_EVENT, handleStatus);
    };
  }, []);

  if (!isOpen) return null;

  const handlePair = async () => {
    setFeedback(null);
    setIsPairing(true);
    try {
      const res = await printerBleService.pairPrinter();
      setFeedback({
        type: 'success',
        text: `Berhasil terhubung ke "${res.name}". Izin tersimpan otomatis.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghubungkan printer.',
      });
    } finally {
      setIsPairing(false);
    }
  };

  const handleReconnect = async () => {
    setFeedback(null);
    setIsPairing(true);
    try {
      const success = await printerBleService.connectSavedPrinter();
      if (success) {
        setFeedback({
          type: 'success',
          text: `Berhasil menyambung ulang ke "${printerBleService.getConnectedDeviceName()}".`,
        });
      } else {
        setFeedback({
          type: 'info',
          text: 'Tidak dapat menyambung otomatis. Silakan klik "Pair Ulang Printer".',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyambung ulang.',
      });
    } finally {
      setIsPairing(false);
    }
  };

  const handleDisconnect = () => {
    printerBleService.disconnect();
    setFeedback({
      type: 'info',
      text: 'Koneksi ke printer telah diputuskan.',
    });
  };

  const handleForget = () => {
    printerBleService.forgetSavedPrinter();
    setFeedback({
      type: 'info',
      text: 'Printer tersimpan telah dihapus.',
    });
  };

  const handleTestPrint = async () => {
    setFeedback(null);
    setIsTesting(true);
    try {
      await printerBleService.printTestPage(currentOutlet?.nama || 'POS F&B Multi-Outlet');
      setFeedback({
        type: 'success',
        text: 'Uji cetak berhasil dikirim ke printer!',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal melakukan uji cetak.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAdvanced = () => {
    printerBleService.setServiceUuid(serviceUuid);
    printerBleService.setCharUuid(charUuid);
    setFeedback({
      type: 'success',
      text: 'Konfigurasi UUID berhasil disimpan.',
    });
    setShowAdvanced(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                Pengaturan Printer Thermal
              </h2>
              <p className="text-xs text-stone-500">Koneksi Bluetooth Web ESC/POS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Status Banner */}
          {!isSupported ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Browser Tidak Mendukung Bluetooth Web</span>
                <span>
                  Perangkat iOS / browser tertentu tidak mendukung Web Bluetooth API.
                  Gunakan tombol cetak struk digital bawaan browser (window.print).
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : savedDevice
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-stone-50 border-stone-200 text-stone-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Bluetooth className="w-5 h-5 text-stone-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {isConnected
                      ? `Terhubung: ${deviceName}`
                      : savedDevice
                      ? `Tersimpan: ${savedDevice.name} (Terputus)`
                      : 'Belum Terhubung'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {isConnected
                      ? 'Siap mencetak struk secara instan'
                      : savedDevice
                      ? 'Klik sambung ulang untuk mengaktifkan printer'
                      : 'Pasangkan printer Bluetooth thermal 58mm'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Toast Inline */}
          {feedback && (
            <div className="space-y-1.5">
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
                  feedback.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : feedback.type === 'error'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-stone-100 text-stone-800'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : feedback.type === 'error' ? (
                  <XCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              {(feedback.text.includes('kebijakan keamanan') || feedback.text.includes('izin keamanan')) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium leading-relaxed flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>Web Bluetooth tidak berfungsi di dalam iframe preview. Buka aplikasi sebagai tab mandiri atau gunakan versi deploy.</span>
                </div>
              )}
            </div>
          )}

          {/* Tombol Aksi Pairing & Test */}
          {isSupported && (
            <div className="space-y-2 pt-1">
              {!isConnected && savedDevice && (
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={isPairing}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isPairing ? 'animate-spin' : ''}`} />
                  <span>Sambung Ulang ke {savedDevice.name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePair}
                disabled={isPairing}
                className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition ${
                  isConnected
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
                    : savedDevice
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                <Bluetooth className={`w-4 h-4 ${isPairing ? 'animate-pulse' : ''}`} />
                <span>
                  {isPairing
                    ? 'Mencari Perangkat...'
                    : isConnected || savedDevice
                    ? 'Pair Ulang / Ganti Printer'
                    : 'Pasangkan Printer Bluetooth'}
                </span>
              </button>

              {isConnected && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={isTesting}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition"
                  >
                    <FileText className={`w-4 h-4 ${isTesting ? 'animate-bounce' : ''}`} />
                    <span>{isTesting ? 'Mencetak...' : 'Uji Cetak ESC/POS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center gap-1.5 border border-stone-200 transition"
                  >
                    <Unplug className="w-4 h-4" />
                    <span>Putuskan</span>
                  </button>
                </div>
              )}

              {savedDevice && !isConnected && (
                <button
                  type="button"
                  onClick={handleForget}
                  className="w-full py-2 text-stone-500 hover:text-rose-600 text-xs text-center transition"
                >
                  Lupakan Printer Tersimpan
                </button>
              )}
            </div>
          )}

          {/* Opsi Lanjutan UUID */}
          <div className="pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-stone-400" />
              <span>{showAdvanced ? 'Sembunyikan Pengaturan UUID' : 'Pengaturan UUID Lanjutan'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Service UUID (Default: 000018f0-...)
                  </label>
                  <input
                    type="text"
                    value={serviceUuid}
                    onChange={(e) => setServiceUuid(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Characteristic UUID (Default: 00002af1-...)
                  </label>
                  <input
                    type="text"
                    value={charUuid}
                    onChange={(e) => setCharUuid(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAdvanced}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                  >
                    Simpan UUID
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Catatan Kompatibilitas */}
          <div className="p-3 rounded-xl bg-stone-50 text-[11px] text-stone-500 space-y-1">
            <p className="font-semibold text-stone-700">Catatan Kompatibilitas:</p>
            <p>• Didukung pada Chrome/Edge di Android, Windows, macOS, dan ChromeOS.</p>
            <p>• Izin perangkat diingat otomatis sehingga tidak perlu membuka pemilih Bluetooth setiap sesi.</p>
            <p>• Perangkat iOS tidak mendukung Bluetooth Web; aplikasi akan otomatis mencetak menggunakan dialog browser.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 flex justify-end bg-stone-50/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 font-bold text-stone-800 text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
