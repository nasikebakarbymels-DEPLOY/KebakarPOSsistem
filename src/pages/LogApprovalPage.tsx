import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldCheck,
  Calendar,
  User,
  Receipt,
  ArrowRight,
  AlertCircle,
  Clock,
  Filter,
  CheckCircle2,
  DollarSign,
  Percent,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Transaksi, ApprovalBiayaManual } from '../types';
import { transaksiCloudService, PeriodeFilter } from '../services/cloud/transaksiCloudService';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

interface FlatApprovalRecord extends ApprovalBiayaManual {
  trxId: string;
  nomorTransaksi: string;
  metodeBayar: string;
  totalTransaksi: number;
  trxCreatedAt: string;
}

export const LogApprovalPage: React.FC = () => {
  const { currentOutlet, user } = useAuth();

  // Guard role: hanya owner dan super_admin
  const isAuthorized = user?.role === 'owner' || user?.role === 'super_admin';

  const [periode, setPeriode] = useState<PeriodeFilter>('7hari');
  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast Notification Ref
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Subscribe transaksi real-time
  useEffect(() => {
    if (!currentOutlet?.id || !isAuthorized) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const unsubscribe = transaksiCloudService.subscribeTransaksi(
      currentOutlet.id,
      periode,
      (data) => {
        setTransaksiList(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('[LogApprovalPage] Gagal fetch transaksi:', err);
        setErrorMsg('Gagal memuat log persetujuan biaya manual. Silakan coba lagi.');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentOutlet?.id, periode, isAuthorized]);

  // Flatten dan filter approval record dari transaksi
  const approvalRecords: FlatApprovalRecord[] = useMemo(() => {
    const records: FlatApprovalRecord[] = [];

    transaksiList.forEach((trx) => {
      if (Array.isArray(trx.approvalBiayaManual) && trx.approvalBiayaManual.length > 0) {
        trx.approvalBiayaManual.forEach((app) => {
          records.push({
            ...app,
            trxId: trx.id,
            nomorTransaksi: trx.nomorTransaksi,
            metodeBayar: trx.metodeBayar,
            totalTransaksi: trx.total,
            trxCreatedAt: trx.createdAt,
          });
        });
      }
    });

    // Urutkan terbaru pertama
    records.sort((a, b) => {
      const timeA = new Date(a.approvedAt || a.trxCreatedAt).getTime();
      const timeB = new Date(b.approvedAt || b.trxCreatedAt).getTime();
      return timeB - timeA;
    });

    if (!searchQuery.trim()) return records;

    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.biayaNama.toLowerCase().includes(q) ||
        r.kasirNama.toLowerCase().includes(q) ||
        r.nomorTransaksi.toLowerCase().includes(q)
    );
  }, [transaksiList, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-stone-900">Akses Dibatasi</h2>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          Halaman Log Persetujuan Biaya Manual hanya dapat diakses oleh Owner dan Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in">
          <div
            className={`px-4 py-3 rounded-2xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-orange-600" />
            <span>Log Persetujuan Biaya Manual</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Audit jejak persetujuan PIN Owner saat kasir mengubah nominal atau persentase biaya operasional (delivery, service charge, dll).
          </p>
        </div>

        {/* Filter Periode */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-200/70 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriode('hari')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
              periode === 'hari' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setPeriode('7hari')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
              periode === '7hari' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => setPeriode('30hari')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
              periode === '30hari' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            30 Hari
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama biaya, kasir, atau no. transaksi..."
          className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
        />
      </div>

      {/* Main Content List */}
      {isLoading ? (
        /* Skeleton Loading */
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-stone-200 animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-stone-200 rounded w-1/4" />
                <div className="h-4 bg-stone-200 rounded w-1/6" />
              </div>
              <div className="h-6 bg-stone-100 rounded w-1/2" />
              <div className="h-4 bg-stone-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        /* Error State Panel */
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-xs font-semibold text-rose-800">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              setPeriode((p) => p);
              showToast('Mencoba memuat ulang data...', 'info');
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
          >
            Coba Lagi
          </button>
        </div>
      ) : approvalRecords.length === 0 ? (
        /* Empty State */
        <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3 shadow-2xs">
          <ShieldCheck className="w-12 h-12 text-stone-300 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-stone-800">Belum Ada Persetujuan Biaya Manual</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Tidak ada riwayat persetujuan yang cocok dengan pencarian Anda.'
                : `Tidak ada perubahan nilai biaya manual dengan PIN Owner pada periode ${
                    periode === 'hari' ? 'hari ini' : periode === '7hari' ? '7 hari terakhir' : '30 hari terakhir'
                  }.`}
            </p>
          </div>
        </div>
      ) : (
        /* List Cards */
        <div className="space-y-3">
          <div className="text-xs font-bold text-stone-500 flex items-center justify-between">
            <span>Ditemukan {approvalRecords.length} persetujuan biaya manual:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {approvalRecords.map((rec, idx) => {
              const selisih = rec.nilaiManual - rec.nilaiDefault;
              const isNaik = selisih > 0;
              const formattedTime = rec.approvedAt
                ? formatDateTimeIndo(rec.approvedAt)
                : formatDateTimeIndo(rec.trxCreatedAt);

              return (
                <div
                  key={`${rec.trxId}-${rec.biayaId}-${idx}`}
                  className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:shadow-md transition space-y-3"
                >
                  {/* Header Card: Nama Biaya & Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-stone-900">{rec.biayaNama}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Manual
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <Receipt className="w-3 h-3 text-stone-400" />
                        <span className="font-mono">{rec.nomorTransaksi}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold">{rec.metodeBayar}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        <span>{formattedTime}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 inline-block">
                        Disetujui PIN Owner
                      </span>
                    </div>
                  </div>

                  {/* Body: Komparasi Nilai Default -> Nilai Manual */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Nilai Default</span>
                      <span className="text-xs font-semibold text-stone-600 line-through">
                        {rec.tipe === 'persen' ? `${rec.nilaiDefault}%` : formatRupiah(rec.nilaiDefault)}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-stone-400" />

                    <div>
                      <span className="text-[10px] uppercase font-bold text-orange-600 block">Nilai Manual</span>
                      <span className="text-sm font-black text-stone-900 font-mono">
                        {rec.tipe === 'persen' ? `${rec.nilaiManual}%` : formatRupiah(rec.nilaiManual)}
                      </span>
                    </div>

                    <div className="text-right pl-2 border-l border-stone-200">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">Selisih</span>
                      <span
                        className={`text-xs font-extrabold font-mono ${
                          isNaik ? 'text-rose-600' : selisih < 0 ? 'text-emerald-600' : 'text-stone-500'
                        }`}
                      >
                        {selisih > 0 ? '+' : ''}
                        {rec.tipe === 'persen' ? `${selisih}%` : formatRupiah(selisih)}
                      </span>
                    </div>
                  </div>

                  {/* Footer: Kasir Pemohon */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-stone-400" />
                      <span>
                        Kasir: <strong className="text-stone-800 font-semibold">{rec.kasirNama}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-600 font-medium">
                      Total Belanja: {formatRupiah(rec.totalTransaksi)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
