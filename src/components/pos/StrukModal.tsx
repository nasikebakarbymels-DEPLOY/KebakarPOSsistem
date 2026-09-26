import React, { useState } from 'react';
import {
  Printer,
  CheckCircle2,
  X,
  FileText,
  ArrowRight,
  Bluetooth,
} from 'lucide-react';
import { Transaksi } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { printService } from '../../services/printerService';
import { printerBleService } from '../../services/printerBleService';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';

interface StrukModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi | null;
  onOpenPrinterSettings?: () => void;
}

export const StrukModal: React.FC<StrukModalProps> = ({
  isOpen,
  onClose,
  transaksi,
  onOpenPrinterSettings,
}) => {
  const { currentOutlet } = useAuth();
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen || !transaksi) return null;

  const isBleConnected = printerBleService.isConnected();
  const printerName = printerBleService.getConnectedDeviceName();

  const handlePrint = async () => {
    setFeedback(null);
    setIsPrinting(true);
    try {
      const mode = await printService.printStruk(transaksi, currentOutlet);
      if (mode === 'ble') {
        setFeedback({
          type: 'success',
          text: `Struk berhasil dikirim ke printer "${printerName || 'Bluetooth'}".`,
        });
      } else {
        setFeedback({
          type: 'info',
          text: 'Membuka dialog cetak browser...',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencetak struk.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Transaksi Selesai</h2>
              <p className="text-[11px] text-stone-500">Struk Pembayaran Konsumen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            title="Tutup & Transaksi Baru"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Tampilan Struk 58mm */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-stone-100/50 flex-1">
          {/* Status Bluetooth Chip */}
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <Bluetooth
                className={`w-4 h-4 ${
                  isBleConnected ? 'text-emerald-600' : 'text-stone-400'
                }`}
              />
              <span className="font-semibold text-stone-700">
                {isBleConnected ? `Printer: ${printerName}` : 'Printer: Belum terhubung (Fallback browser)'}
              </span>
            </div>
            {onOpenPrinterSettings && (
              <button
                type="button"
                onClick={onOpenPrinterSettings}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
              >
                Atur
              </button>
            )}
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800'
                  : feedback.type === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-stone-200 text-stone-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Lembar Kertas Struk Termal (Layout 58mm) */}
          <div
            id="printable-receipt"
            className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs font-mono text-xs text-stone-800 mx-auto max-w-[340px]"
            style={{ minHeight: '380px' }}
          >
            {/* Header Outlet */}
            <div className="text-center space-y-0.5 pb-2">
              <h3 className="font-bold text-sm tracking-tight text-stone-900">
                {currentOutlet?.nama || 'POS F&B Multi-Outlet'}
              </h3>
              {currentOutlet?.alamat && (
                <p className="text-[11px] text-stone-600 leading-tight">
                  {currentOutlet.alamat}
                </p>
              )}
              {currentOutlet?.telepon && (
                <p className="text-[10px] text-stone-500">Telp: {currentOutlet.telepon}</p>
              )}
            </div>

            <div className="border-b border-dashed border-stone-300 my-2" />

            {/* Info Transaksi */}
            <div className="space-y-1 text-[11px] text-stone-600">
              <div className="flex justify-between">
                <span>No. TRX:</span>
                <span className="font-bold text-stone-900">{transaksi.nomorTransaksi}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDateTimeIndo(transaksi.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{transaksi.kasirNama || 'Kasir'}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-stone-300 my-2" />

            {/* Daftar Item Pesanan */}
            <div className="space-y-2 py-1 text-xs">
              {transaksi.items.map((it, idx) => {
                const hasItemDiscount = Boolean(it.diskonProdukNominal && it.diskonProdukNominal > 0);
                const hargaAsli = it.hargaAsli || (hasItemDiscount ? it.hargaJual + (it.diskonProdukNominal || 0) : it.hargaJual);
                const hargaNeto = it.hargaUnitNeto || it.hargaJual;

                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-stone-900 leading-snug">{it.nama}</div>
                    <div className="flex justify-between items-baseline text-[11px] text-stone-600">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{it.qty} x</span>
                        {hasItemDiscount ? (
                          <>
                            <span className="line-through text-stone-400">{formatRupiah(hargaAsli)}</span>
                            <span className="font-semibold text-stone-900">{formatRupiah(hargaNeto)}</span>
                          </>
                        ) : (
                          <span>{formatRupiah(it.hargaJual)}</span>
                        )}
                      </div>
                      <span className="font-semibold text-stone-900">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-b border-dashed border-stone-300 my-2" />

            {/* Total & Rincian Bertingkat */}
            <div className="space-y-1 text-xs">
              {/* Subtotal Kotor dan Diskon Promo Produk jika ada */}
              {transaksi.diskonProdukTotal && transaksi.diskonProdukTotal > 0 ? (
                <>
                  <div className="flex justify-between text-stone-600 text-[11px]">
                    <span>Subtotal Kotor:</span>
                    <span>
                      {formatRupiah(
                        transaksi.items.reduce(
                          (acc, it) => acc + (it.hargaAsli || it.hargaJual) * it.qty,
                          0
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 text-[11px] font-medium">
                    <span>Diskon Promo Menu:</span>
                    <span>- {formatRupiah(transaksi.diskonProdukTotal)}</span>
                  </div>
                </>
              ) : null}

              {/* Potongan Voucher jika ada */}
              {transaksi.voucherNilai && transaksi.voucherNilai > 0 ? (
                <div className="flex justify-between text-emerald-700 font-semibold text-[11px]">
                  <span>Voucher ({transaksi.voucherKode || 'PROMO'}):</span>
                  <span>- {formatRupiah(transaksi.voucherNilai)}</span>
                </div>
              ) : null}

              {/* Daftar Biaya Lain jika ada */}
              {transaksi.biayaLainList && transaksi.biayaLainList.length > 0 ? (
                transaksi.biayaLainList.map((b, bIdx) => (
                  <div key={bIdx} className="flex justify-between text-stone-600 text-[11px]">
                    <span>
                      {b.nama} {b.tipe === 'persen' ? `(${b.nilaiDipakai ?? b.nilai}%)` : ''}
                      {b.isManual ? ' [Manual]' : ''}:
                    </span>
                    <span>+ {formatRupiah(b.subtotal)}</span>
                  </div>
                ))
              ) : null}

              {transaksi.approvalBiayaManual && transaksi.approvalBiayaManual.length > 0 ? (
                <div className="text-[10px] text-purple-700 font-medium italic pt-0.5">
                  * Biaya manual telah diverifikasi PIN Owner
                </div>
              ) : null}

              <div className="flex justify-between font-black text-stone-900 text-sm pt-1.5 border-t border-dashed border-stone-300">
                <span>TOTAL AKHIR</span>
                <span className="text-orange-600">{formatRupiah(transaksi.total)}</span>
              </div>
              <div className="flex justify-between text-stone-600 text-[11px] pt-1">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase text-stone-800">
                  {transaksi.metodeBayar}
                </span>
              </div>

              {transaksi.metodeBayar === 'tunai' && (
                <>
                  <div className="flex justify-between text-stone-600 text-[11px]">
                    <span>Uang Diterima:</span>
                    <span className="font-semibold text-stone-800">
                      {formatRupiah(transaksi.uangDiterima || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600 text-[11px]">
                    <span>Kembalian:</span>
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(transaksi.kembalian || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="border-b border-dashed border-stone-300 my-3" />

            {/* Footer Ucapan */}
            <div className="text-center text-[10px] text-stone-500 space-y-0.5">
              <p>Terima kasih atas kunjungan Anda!</p>
              <p>Barang yang sudah dibeli tidak dapat ditukar.</p>
            </div>
          </div>
        </div>

        {/* Footer Tombol Aksi */}
        <div className="p-4 border-t border-stone-100 bg-white grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Mencetak...' : 'Cetak Struk'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
