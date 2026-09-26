import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Receipt,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Wallet,
  Plus,
  ArrowDownRight,
  Filter,
  History,
} from 'lucide-react';
import { RingkasanPiutangPelanggan, Transaksi, CatatanCicilanPiutang, Outlet } from '../../types';
import { piutangService } from '../../services/piutangService';
import { formatRupiah, formatDateTimeIndo, formatTanggalIndo } from '../../utils/formatters';
import { CatatCicilanModal } from './CatatCicilanModal';
import { useAuth } from '../../context/AuthContext';

interface BukuPiutangSegmentProps {
  currentOutlet: Outlet | null;
}

export const BukuPiutangSegment: React.FC<BukuPiutangSegmentProps> = ({ currentOutlet }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [pelangganList, setPelangganList] = useState<RingkasanPiutangPelanggan[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTrxForBayar, setSelectedTrxForBayar] = useState<Transaksi | null>(null);
  const [expandedPelangganNama, setExpandedPelangganNama] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadData = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    try {
      const data = await piutangService.getRekapPiutangPelanggan(currentOutlet.id);
      setPelangganList(data);
    } catch (err) {
      console.error('Gagal memuat buku piutang:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('pos_fnb_transaksi_updated', handleUpdate);
    window.addEventListener('pos_fnb_piutang_updated', handleUpdate);
    return () => {
      window.removeEventListener('pos_fnb_transaksi_updated', handleUpdate);
      window.removeEventListener('pos_fnb_piutang_updated', handleUpdate);
    };
  }, [loadData]);

  // Hitung total ringkasan piutang aktif
  const ringkasanGlobal = useMemo(() => {
    let totalPiutangBelumLunas = 0;
    let totalSudahTerbayar = 0;
    let pelangganBerhutangCount = 0;

    pelangganList.forEach((p) => {
      totalPiutangBelumLunas += p.totalSisaHutang;
      totalSudahTerbayar += p.totalSudahDibayar;
      if (p.totalSisaHutang > 0) {
        pelangganBerhutangCount += 1;
      }
    });

    return {
      totalPiutangBelumLunas,
      totalSudahTerbayar,
      pelangganBerhutangCount,
      totalPelangganPiutang: pelangganList.length,
    };
  }, [pelangganList]);

  // Filter pencarian pelanggan
  const filteredPelanggan = useMemo(() => {
    if (!searchQuery.trim()) return pelangganList;
    const q = searchQuery.toLowerCase().trim();
    return pelangganList.filter((p) => p.pelangganNama.toLowerCase().includes(q));
  }, [pelangganList, searchQuery]);

  const handleCatatCicilanSuccess = async (payload: {
    transaksiId: string;
    jumlah: number;
    metode: 'tunai' | 'transfer';
    tanggal: string;
    catatan?: string;
  }) => {
    if (!currentOutlet?.id) return;
    try {
      await piutangService.catatPembayaranCicilan(currentOutlet.id, payload);
      showToast(
        `Pembayaran cicilan sebesar ${formatRupiah(payload.jumlah)} berhasil dicatat.`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal mencatat cicilan.', 'error');
    }
  };

  // Guard role kasir: kasir tidak diperkenankan melihat buku piutang
  if (user?.role === 'kasir') {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Summary Banner Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs">
            <Wallet className="w-3.5 h-3.5 text-red-600" />
            <span className="font-medium">Total Sisa Piutang</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-red-600 font-sans tracking-tight">
            {formatRupiah(ringkasanGlobal.totalPiutangBelumLunas)}
          </p>
          <p className="text-[10.5px] text-stone-400">
            {ringkasanGlobal.pelangganBerhutangCount} pelanggan belum lunas
          </p>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs space-y-1">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">Total Cicilan Terbayar</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-stone-900 font-sans tracking-tight">
            {formatRupiah(ringkasanGlobal.totalSudahTerbayar)}
          </p>
          <p className="text-[10.5px] text-stone-400">Dari seluruh riwayat piutang</p>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          id="input-cari-pelanggan-piutang"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan piutang..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
          >
            Hapus
          </button>
        )}
      </div>

      {/* List Pelanggan Piutang */}
      {loading ? (
        <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center text-xs text-stone-500">
          Memuat buku piutang pelanggan...
        </div>
      ) : filteredPelanggan.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 text-sm">
            {searchQuery ? 'Pelanggan Tidak Ditemukan' : 'Tidak Ada Piutang'}
          </h4>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            {searchQuery
              ? `Tidak ada data piutang dengan nama "${searchQuery}".`
              : 'Outlet ini belum memiliki transaksi piutang atau seluruh piutang pelanggan telah lunas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPelanggan.map((pelanggan) => {
            const isExpanded = expandedPelangganNama === pelanggan.pelangganNama;
            const isLunas = pelanggan.totalSisaHutang === 0;

            return (
              <div
                key={pelanggan.pelangganNama}
                className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-xs ${
                  isLunas ? 'border-stone-200' : 'border-red-200'
                }`}
              >
                {/* Header Pelanggan */}
                <div
                  onClick={() =>
                    setExpandedPelangganNama(isExpanded ? null : pelanggan.pelangganNama)
                  }
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-xs ${
                        isLunas
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pelanggan.pelangganNama.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-stone-900 text-sm">
                          {pelanggan.pelangganNama}
                        </h4>
                        {isLunas ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            LUNAS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">
                            {pelanggan.transaksiBelumLunasCount} Tagihan Belum Lunas
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {pelanggan.transaksiList.length} transaksi • Terbayar:{' '}
                        {formatRupiah(pelanggan.totalSudahDibayar)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block">Sisa Hutang</span>
                      <span
                        className={`text-sm font-black font-sans ${
                          isLunas ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatRupiah(pelanggan.totalSisaHutang)}
                      </span>
                    </div>
                    <div className="text-stone-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Detail Transaksi & Cicilan Expandable */}
                {isExpanded && (
                  <div className="border-t border-stone-100 bg-stone-50/50 p-4 space-y-4 animate-in fade-in">
                    {/* Daftar Transaksi Piutang */}
                    <div className="space-y-2">
                      <h5 className="font-extrabold text-xs text-stone-800 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-orange-600" />
                        <span>Daftar Tagihan Transaksi</span>
                      </h5>

                      <div className="space-y-2">
                        {pelanggan.transaksiList.map((trx) => {
                          const sisa = trx.pembayaran?.sisaHutang || 0;
                          const trxLunas = sisa === 0;

                          return (
                            <div
                              key={trx.id}
                              className="bg-white p-3.5 rounded-2xl border border-stone-200 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-stone-900">
                                      {trx.nomorTransaksi}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                                        trxLunas
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : trx.statusPembayaran === 'sebagian'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {trxLunas
                                        ? 'LUNAS'
                                        : trx.statusPembayaran === 'sebagian'
                                        ? 'SEBAGIAN'
                                        : 'HUTANG'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-stone-400 mt-0.5">
                                    {formatDateTimeIndo(trx.tanggal || trx.createdAt)} • Kasir: {trx.kasirNama}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] text-stone-400 block">
                                    Sisa Tagihan
                                  </span>
                                  <span
                                    className={`font-black font-sans text-xs ${
                                      trxLunas ? 'text-emerald-700' : 'text-red-600'
                                    }`}
                                  >
                                    {formatRupiah(sisa)}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2 bg-stone-50 rounded-xl flex justify-between text-[11px] text-stone-600">
                                <span>Total Belanja: {formatRupiah(trx.totalAkhir || trx.total)}</span>
                                <span>
                                  Dibayar Awal: {formatRupiah(trx.pembayaran?.jumlahDibayar || 0)}
                                </span>
                              </div>

                              {!trxLunas && (
                                <button
                                  type="button"
                                  id={`btn-catat-bayar-${trx.nomorTransaksi}`}
                                  onClick={() => setSelectedTrxForBayar(trx)}
                                  className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Catat Pembayaran Cicilan</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Riwayat Pembayaran Cicilan Pelanggan */}
                    {pelanggan.cicilanList.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-stone-200">
                        <h5 className="font-extrabold text-xs text-stone-800 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Riwayat Cicilan Diterima ({pelanggan.cicilanList.length})</span>
                        </h5>

                        <div className="space-y-1.5">
                          {pelanggan.cicilanList.map((ccl) => (
                            <div
                              key={ccl.id}
                              className="p-2.5 bg-white rounded-xl border border-stone-200 text-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-stone-900">
                                    {formatRupiah(ccl.jumlah)}
                                  </span>
                                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded capitalize">
                                    {ccl.metode}
                                  </span>
                                </div>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  {formatTanggalIndo(ccl.tanggal)}
                                  {ccl.catatan ? ` • "${ccl.catatan}"` : ''}
                                </p>
                              </div>
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                                Diterima
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Catat Pembayaran */}
      {selectedTrxForBayar && currentOutlet && (
        <CatatCicilanModal
          isOpen={!!selectedTrxForBayar}
          onClose={() => setSelectedTrxForBayar(null)}
          transaksi={selectedTrxForBayar}
          outletId={currentOutlet.id}
          onSuccess={() => loadData()}
          onCatat={handleCatatCicilanSuccess}
        />
      )}
    </div>
  );
};
