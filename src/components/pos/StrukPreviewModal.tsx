import React, { useRef, useEffect, useState } from 'react';
import { X, Printer, Check, Copy, Share2, Receipt } from 'lucide-react';
import { Transaksi, Outlet } from '../../types';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';

interface StrukPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi | null;
  outlet: Outlet | null;
  onPrintBluetooth?: () => void | Promise<void>;
  bluetoothConnected?: boolean;
}

export const StrukPreviewModal: React.FC<StrukPreviewModalProps> = ({
  isOpen,
  onClose,
  transaksi,
  outlet,
  onPrintBluetooth,
  bluetoothConnected = false,
}) => {

  const strukRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !transaksi) return null;

  const handlePrintBrowser = () => {
    window.print();
  };

  const handleCopyText = async () => {
    if (!transaksi) return;
    const itemsText = transaksi.items
      .map(
        (it) =>
          `- ${it.nama} (${it.qty}x @${formatRupiah(it.hargaJual)}) = ${formatRupiah(
            (it.hargaJual - (it.diskonItem || 0)) * it.qty
          )}`
      )
      .join('\n');

    const paymentText =
      transaksi.pembayaran?.metode === 'tunai'
        ? `Tunai (Uang: ${formatRupiah(transaksi.pembayaran.uangDiterima || 0)}, Kembalian: ${formatRupiah(
            transaksi.pembayaran.kembalian || 0
          )})`
        : transaksi.pembayaran?.metode === 'qris_transfer'
        ? `QRIS/Transfer (Ref: ${transaksi.pembayaran.referensi || '-'})`
        : `Piutang: ${transaksi.pembayaran?.pelangganNama || 'Pelanggan'} (Dibayar: ${formatRupiah(
            transaksi.pembayaran?.jumlahDibayar || 0
          )}, Sisa Hutang: ${formatRupiah(transaksi.pembayaran?.sisaHutang || 0)})`;

    const textToCopy = `=== STRUK PEMBELIAN ===
Outlet: ${outlet?.nama || 'POS F&B'}
No. Trx: ${transaksi.nomorTransaksi}
Waktu: ${formatDateTimeIndo(transaksi.tanggal || transaksi.createdAt)}
Kasir: ${transaksi.kasirNama}
Pesanan: ${transaksi.tipePesanan === 'dine_in' ? `Dine-in (Meja ${transaksi.nomorMeja || '-'})` : 'Takeaway'}
------------------------
ITEMS:
${itemsText}
------------------------
Total: ${formatRupiah(transaksi.totalAkhir || transaksi.total)}
Pembayaran: ${paymentText}
Status: ${(transaksi.statusPembayaran || transaksi.status || 'selesai').toUpperCase()}
========================
Terima kasih atas kunjungan Anda!`;

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error('Clipboard API tidak didukung');
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setCopyError(null);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
      setCopyError('Gagal menyalin teks struk. Silakan coba lagi.');
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopyError(null);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-orange-600" />
            <h3 className="font-extrabold text-stone-900 text-sm">
              Preview Struk Digital
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-200/70 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Struk Content Container (Paper Look) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-stone-100/70 flex justify-center">
          {/* Card Kertas Struk max-w-[320px] */}
          <div
            ref={strukRef}
            id="digital-receipt-paper"
            className="w-full max-w-[320px] bg-white p-4 rounded-xl shadow-xs border border-stone-200 font-mono text-[11px] leading-relaxed text-stone-800 space-y-2.5 print:m-0 print:border-none print:shadow-none"
          >
            {/* Header Struk */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-stone-300">
              <h2 className="font-extrabold text-sm text-stone-950 tracking-tight font-sans">
                {outlet?.nama || 'OUTLET F&B'}
              </h2>
              {outlet?.alamat && (
                <p className="text-[10px] text-stone-500 leading-tight">
                  {outlet.alamat}
                </p>
              )}
              {outlet?.telepon && (
                <p className="text-[10px] text-stone-400">Telp: {outlet.telepon}</p>
              )}
            </div>

            {/* Metadata Transaksi */}
            <div className="space-y-0.5 text-[10px] text-stone-600 pb-2 border-b border-dashed border-stone-300">
              <div className="flex justify-between">
                <span>No. Trx</span>
                <span className="font-bold text-stone-900">
                  {transaksi.nomorTransaksi}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Waktu</span>
                <span>{formatDateTimeIndo(transaksi.tanggal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir</span>
                <span>{transaksi.kasirNama}</span>
              </div>
              <div className="flex justify-between">
                <span>Tipe Order</span>
                <span className="font-semibold text-stone-800">
                  {transaksi.tipePesanan === 'dine_in'
                    ? `Dine-in (Meja ${transaksi.nomorMeja || '-'})`
                    : 'Takeaway'}
                </span>
              </div>
            </div>

            {/* Item List */}
            <div className="space-y-1.5 pb-2 border-b border-dashed border-stone-300">
              {transaksi.items.map((item, idx) => {
                const subtotal =
                  (item.hargaJual - (item.diskonItem || 0)) * item.qty;
                return (
                  <div key={item.id || idx} className="space-y-0.5">
                    <div className="flex justify-between font-medium text-stone-900">
                      <span className="truncate pr-1">{item.nama}</span>
                      <span className="shrink-0">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-500">
                      <span>
                        {item.qty} x @{formatRupiah(item.hargaJual)}
                        {(item.diskonItem || 0) > 0 && (
                          <span className="text-emerald-700 ml-1">
                            (Disc -{formatRupiah(item.diskonItem || 0)})
                          </span>
                        )}
                      </span>
                    </div>
                    {item.catatan && (
                      <p className="text-[9px] text-stone-400 italic">
                        * {item.catatan}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ringkasan Finansial */}
            <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-stone-300">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatRupiah(transaksi.subtotalKotor || transaksi.total)}</span>
              </div>

              {(transaksi.totalDiskonItem || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Total Diskon Menu</span>
                  <span>-{formatRupiah(transaksi.totalDiskonItem || 0)}</span>
                </div>
              )}

              {(transaksi.diskonTransaksiNominal || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>
                    Diskon Transaksi (
                    {transaksi.diskonTransaksiTipe === 'persen'
                      ? `${transaksi.diskonTransaksiNilai}%`
                      : 'Nominal'}
                    )
                  </span>
                  <span>-{formatRupiah(transaksi.diskonTransaksiNominal || 0)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1 font-extrabold text-xs text-stone-950">
                <span>TOTAL AKHIR</span>
                <span className="text-sm font-sans">
                  {formatRupiah(transaksi.totalAkhir || transaksi.total)}
                </span>
              </div>
            </div>

            {/* Rincian Pembayaran */}
            <div className="space-y-1 text-[10px] pb-2 border-b border-dashed border-stone-300">
              <div className="flex justify-between font-semibold text-stone-800">
                <span>Metode Pembayaran</span>
                <span className="uppercase font-bold">
                  {transaksi.pembayaran?.metode === 'tunai'
                    ? 'TUNAI'
                    : transaksi.pembayaran?.metode === 'qris_transfer'
                    ? 'QRIS / TRANSFER'
                    : 'PIUTANG'}
                </span>
              </div>

              {transaksi.pembayaran?.metode === 'tunai' && (
                <>
                  <div className="flex justify-between text-stone-600">
                    <span>Uang Diterima</span>
                    <span>
                      {formatRupiah(transaksi.pembayaran.uangDiterima || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900">
                    <span>Kembalian</span>
                    <span>
                      {formatRupiah(transaksi.pembayaran.kembalian || 0)}
                    </span>
                  </div>
                </>
              )}

              {transaksi.pembayaran?.metode === 'qris_transfer' && (
                <div className="flex justify-between text-stone-600">
                  <span>Referensi / Bukti</span>
                  <span className="font-mono">
                    {transaksi.pembayaran.referensi || '-'}
                  </span>
                </div>
              )}

              {transaksi.pembayaran?.metode === 'piutang' && (
                <>
                  <div className="flex justify-between text-stone-600">
                    <span>Nama Pelanggan</span>
                    <span className="font-bold text-stone-900">
                      {transaksi.pembayaran.pelangganNama || 'Pelanggan'}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Dibayar Sekarang</span>
                    <span>
                      {formatRupiah(transaksi.pembayaran.jumlahDibayar || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600">
                    <span>Sisa Hutang</span>
                    <span>
                      {formatRupiah(transaksi.pembayaran.sisaHutang || 0)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-stone-500 pt-0.5">
                <span>Status Tagihan</span>
                <span
                  className={`font-bold uppercase ${
                    transaksi.statusPembayaran === 'lunas'
                      ? 'text-emerald-700'
                      : transaksi.statusPembayaran === 'sebagian'
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {transaksi.statusPembayaran === 'lunas'
                    ? 'LUNAS'
                    : transaksi.statusPembayaran === 'sebagian'
                    ? 'DIBAYAR SEBAGIAN'
                    : 'BELUM LUNAS (HUTANG)'}
                </span>
              </div>
            </div>

            {/* Footer Struk */}
            <div className="text-center pt-1 text-[10px] text-stone-400 space-y-0.5">
              <p className="font-semibold text-stone-600">
                Terima Kasih Atas Kunjungan Anda
              </p>
              <p className="text-[9px]">Layanan Pelanggan POS F&B</p>
            </div>
          </div>
        </div>

        {/* Footer Modal: Tombol Aksi */}
        <div className="p-3.5 sm:p-4 border-t border-stone-200 bg-white space-y-2">
          {copyError && (
            <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-xl text-center font-medium border border-red-200">
              {copyError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 py-2.5 px-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintBrowser}
              className="flex-1 py-2.5 px-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Browser</span>
            </button>
          </div>

          {/* Tombol Bluetooth Thermal Printer */}
          <div className="relative">
            {bluetoothConnected ? (
              <button
                type="button"
                onClick={onPrintBluetooth}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak via Bluetooth Thermal</span>
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-medium">
                  Terhubung
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                title={
                  typeof navigator !== 'undefined' && 'bluetooth' in navigator
                    ? 'Printer Bluetooth belum terhubung. Silakan hubungkan di tab Lainnya.'
                    : 'Perangkat atau browser ini tidak mendukung Web Bluetooth.'
                }
                className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-400 border border-stone-200 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Printer className="w-3.5 h-3.5 text-stone-400" />
                <span>Cetak via Bluetooth Thermal</span>
                <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded font-normal">
                  {typeof navigator !== 'undefined' && 'bluetooth' in navigator
                    ? 'Belum Terhubung'
                    : 'Tidak Didukung Browser'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
