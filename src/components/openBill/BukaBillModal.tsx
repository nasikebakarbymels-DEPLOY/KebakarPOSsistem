import React, { useState, useEffect } from 'react';
import {
  X,
  Utensils,
  ShoppingBag,
  Bike,
  CalendarClock,
  UserCheck,
  PartyPopper,
  AlertCircle,
  Loader2,
  Check,
  Plus,
} from 'lucide-react';
import { TipeOpenBill, OpenBill, OpenBillMeta, Pelanggan } from '../../types';
import { openBillCloudService } from '../../services/cloud/openBillCloudService';
import { pelangganService } from '../../services/pelangganService';
import { useAuth } from '../../context/AuthContext';

interface BukaBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (bill: OpenBill) => void;
}

interface TipeOption {
  id: TipeOpenBill;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultLabelPrefix: string;
  color: string;
}

const TIPE_OPTIONS: TipeOption[] = [
  {
    id: 'dine_in',
    label: 'Dine-In',
    sub: 'Makan di tempat',
    icon: Utensils,
    defaultLabelPrefix: 'Meja ',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    id: 'takeaway',
    label: 'Takeaway',
    sub: 'Bungkus / bawa pulang',
    icon: ShoppingBag,
    defaultLabelPrefix: 'Takeaway #',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    sub: 'Pesanan antar kurir',
    icon: Bike,
    defaultLabelPrefix: 'Delivery - ',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    id: 'pre_order',
    label: 'Pre-Order',
    sub: 'Pesanan tanggal depan',
    icon: CalendarClock,
    defaultLabelPrefix: 'PO - ',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  {
    id: 'utang',
    label: 'Utang / Piutang',
    sub: 'Bayar tempo pelanggan',
    icon: UserCheck,
    defaultLabelPrefix: 'Utang - ',
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
  {
    id: 'katering',
    label: 'Katering',
    sub: 'Pesanan partai besar',
    icon: PartyPopper,
    defaultLabelPrefix: 'Katering - ',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
];

export const BukaBillModal: React.FC<BukaBillModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { currentOutlet, user } = useAuth();

  const [tipe, setTipe] = useState<TipeOpenBill>('dine_in');
  const [label, setLabel] = useState<string>('Meja 1');
  const [groupId, setGroupId] = useState<string>('');

  // Meta fields
  const [nomorMeja, setNomorMeja] = useState<string>('1');
  const [alamat, setAlamat] = useState<string>('');
  const [patokan, setPatokan] = useState<string>('');
  const [ongkir, setOngkir] = useState<string>('');
  const [tanggalAmbil, setTanggalAmbil] = useState<string>('');
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [selectedPelangganId, setSelectedPelangganId] = useState<string>('');
  const [namaPelangganManual, setNamaPelangganManual] = useState<string>('');
  const [hpPelangganManual, setHpPelangganManual] = useState<string>('');
  const [tanggalAcara, setTanggalAcara] = useState<string>('');
  const [jumlahPorsi, setJumlahPorsi] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambil daftar pelanggan saat modal dibuka
  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      pelangganService
        .getPelangganByOutlet(currentOutlet.id)
        .then((list) => setPelangganList(list))
        .catch((err) => console.warn('Gagal memuat pelanggan:', err));
    }
  }, [isOpen, currentOutlet?.id]);

  // Update label otomatis saat tipe berubah atau saat input tertentu berubah
  const handleSelectTipe = (newTipe: TipeOpenBill) => {
    setTipe(newTipe);
    setErrorMessage(null);

    const todayIso = new Date().toISOString().split('T')[0];

    if (newTipe === 'dine_in') {
      const val = nomorMeja.trim() || '1';
      setLabel(`Meja ${val}`);
    } else if (newTipe === 'takeaway') {
      const rand = Math.floor(100 + Math.random() * 900);
      setLabel(`Takeaway #${rand}`);
    } else if (newTipe === 'delivery') {
      setLabel('Delivery - ');
      if (!ongkir) setOngkir('5000');
    } else if (newTipe === 'pre_order') {
      setLabel('PO - Pelanggan');
      if (!tanggalAmbil) setTanggalAmbil(todayIso);
    } else if (newTipe === 'utang') {
      setLabel('Utang - Pelanggan');
    } else if (newTipe === 'katering') {
      setLabel('Katering - Resepsi');
      if (!tanggalAcara) setTanggalAcara(todayIso);
      if (!jumlahPorsi) setJumlahPorsi('50');
    }
  };

  const handleMejaChange = (val: string) => {
    setNomorMeja(val);
    if (tipe === 'dine_in') {
      setLabel(`Meja ${val.trim()}`);
    }
  };

  const handlePelangganSelect = (plgId: string) => {
    setSelectedPelangganId(plgId);
    const plg = pelangganList.find((p) => p.id === plgId);
    if (plg) {
      setLabel(`${tipe === 'utang' ? 'Utang - ' : 'PO - '}${plg.nama}`);
      setNamaPelangganManual(plg.nama);
      if (plg.nomorHp) setHpPelangganManual(plg.nomorHp);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id) return;

    setErrorMessage(null);

    const trimmedLabel = label.trim();
    if (trimmedLabel.length < 2) {
      setErrorMessage('Label open bill minimal 2 karakter.');
      return;
    }

    // Persiapkan meta
    const meta: OpenBillMeta = {};

    if (tipe === 'dine_in') {
      if (!nomorMeja.trim()) {
        setErrorMessage('Nomor meja wajib diisi.');
        return;
      }
      meta.nomorMeja = nomorMeja.trim();
    } else if (tipe === 'delivery') {
      if (!alamat.trim()) {
        setErrorMessage('Alamat pengiriman wajib diisi.');
        return;
      }
      meta.alamat = alamat.trim();
      meta.patokan = patokan.trim() || undefined;
      meta.ongkir = ongkir ? Math.max(0, parseInt(ongkir, 10) || 0) : 0;
    } else if (tipe === 'pre_order') {
      if (!tanggalAmbil.trim()) {
        setErrorMessage('Tanggal ambil pesanan wajib diisi.');
        return;
      }
      meta.tanggalAmbil = tanggalAmbil.trim();
      meta.patokan = patokan.trim() || undefined;
      if (selectedPelangganId) {
        meta.pelangganId = selectedPelangganId;
        const plg = pelangganList.find((p) => p.id === selectedPelangganId);
        meta.pelangganNama = plg?.nama;
      } else if (namaPelangganManual.trim()) {
        meta.pelangganNama = namaPelangganManual.trim();
      }
    } else if (tipe === 'utang') {
      let finalPlgId = selectedPelangganId;
      let finalPlgNama = '';

      if (!finalPlgId) {
        // Cek apakah ada input nama manual
        if (!namaPelangganManual.trim()) {
          setErrorMessage('Pilih pelanggan dari daftar atau isi nama pelanggan baru.');
          return;
        }
        // Buat data pelanggan baru
        try {
          const newPlg = await pelangganService.createPelanggan(currentOutlet.id, {
            nama: namaPelangganManual.trim(),
            nomorHp: hpPelangganManual.trim() || undefined,
          });
          finalPlgId = newPlg.id;
          finalPlgNama = newPlg.nama;
        } catch (err: unknown) {
          setErrorMessage(err instanceof Error ? err.message : 'Gagal mendaftarkan pelanggan baru.');
          return;
        }
      } else {
        const plg = pelangganList.find((p) => p.id === finalPlgId);
        finalPlgNama = plg?.nama || '';
      }

      meta.pelangganId = finalPlgId;
      meta.pelangganNama = finalPlgNama;
    } else if (tipe === 'katering') {
      if (!tanggalAcara.trim()) {
        setErrorMessage('Tanggal acara wajib diisi.');
        return;
      }
      const porsiNum = parseInt(jumlahPorsi, 10);
      if (!porsiNum || porsiNum <= 0) {
        setErrorMessage('Jumlah porsi wajib lebih dari 0.');
        return;
      }
      meta.tanggalAcara = tanggalAcara.trim();
      meta.jumlahPorsi = porsiNum;
      meta.alamat = alamat.trim() || undefined;
      meta.patokan = patokan.trim() || undefined;
    }

    try {
      setIsSubmitting(true);
      const created = await openBillCloudService.createOpenBill(
        currentOutlet.id,
        {
          label: trimmedLabel,
          tipe,
          meta,
          groupId: groupId.trim() || undefined,
        },
        user?.id || 'kasir',
        user?.nama || 'Kasir'
      );

      onCreated(created);
      onClose();
    } catch (err: unknown) {
      console.error('Gagal membuat open bill:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membuat open bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
              Buka Open Bill Baru
            </h2>
            <p className="text-xs text-stone-500">
              Pilih tipe pesanan fleksibel untuk ditampung dan diproses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6 Pilihan Tipe Kartu Besar */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              Pilih Tipe Pesanan <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = tipe === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectTipe(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? `${opt.color} ring-2 ring-orange-500 shadow-xs font-bold`
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-white shadow-xs' : 'bg-stone-200/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div>
                      <div className="text-xs font-black">{opt.label}</div>
                      <div className="text-[10px] text-stone-500 line-clamp-1">{opt.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Label Utama */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Label Bill / Nama Tagihan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Contoh: Meja 5, Delivery Ibu Ani, dll."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Nama ini akan dicetak pada tiket pesanan dapur dan tertera pada daftar open bill.
            </p>
          </div>

          {/* Field Spesifik Sesuai Tipe */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="text-xs font-extrabold text-stone-900 border-b border-stone-200 pb-1.5 flex items-center gap-1.5">
              <span>Detail Metadata:</span>
              <span className="text-orange-600 uppercase">
                {TIPE_OPTIONS.find((t) => t.id === tipe)?.label}
              </span>
            </div>

            {/* DINE IN */}
            {tipe === 'dine_in' && (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nomor Meja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nomorMeja}
                  onChange={(e) => handleMejaChange(e.target.value)}
                  placeholder="Misal: 1, 2B, VIP"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {/* DELIVERY */}
            {tipe === 'delivery' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Alamat Pengiriman <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Alamat lengkap tujuan antar..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Patokan Lokasi
                    </label>
                    <input
                      type="text"
                      value={patokan}
                      onChange={(e) => setPatokan(e.target.value)}
                      placeholder="Depan masjid, cat biru..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Ongkir (Rp)
                    </label>
                    <input
                      type="number"
                      value={ongkir}
                      onChange={(e) => setOngkir(e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* PRE ORDER */}
            {tipe === 'pre_order' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Tanggal Ambil / Siap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggalAmbil}
                    onChange={(e) => setTanggalAmbil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Pilih Pelanggan (Opsional)
                  </label>
                  <select
                    value={selectedPelangganId}
                    onChange={(e) => handlePelangganSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  >
                    <option value="">-- Pilih dari Daftar Pelanggan --</option>
                    {pelangganList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} {p.nomorHp ? `(${p.nomorHp})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Catatan / Instruksi Khusus
                  </label>
                  <input
                    type="text"
                    value={patokan}
                    onChange={(e) => setPatokan(e.target.value)}
                    placeholder="Ambil jam 14:00, box terpisah..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </>
            )}

            {/* UTANG / PIUTANG */}
            {tipe === 'utang' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Pilih Pelanggan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPelangganId}
                    onChange={(e) => handlePelangganSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  >
                    <option value="">-- Pilih Pelanggan Terdaftar --</option>
                    {pelangganList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} {p.nomorHp ? `(${p.nomorHp})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedPelangganId && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                    <p className="text-[11px] font-bold text-amber-900">
                      Atau Daftarkan Pelanggan Baru:
                    </p>
                    <input
                      type="text"
                      value={namaPelangganManual}
                      onChange={(e) => {
                        setNamaPelangganManual(e.target.value);
                        setLabel(`Utang - ${e.target.value}`);
                      }}
                      placeholder="Nama Lengkap Pelanggan *"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none"
                    />
                    <input
                      type="tel"
                      value={hpPelangganManual}
                      onChange={(e) => setHpPelangganManual(e.target.value)}
                      placeholder="Nomor HP / WA (Opsional)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* KATERING */}
            {tipe === 'katering' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Tanggal Acara <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalAcara}
                      onChange={(e) => setTanggalAcara(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Jumlah Porsi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={jumlahPorsi}
                      onChange={(e) => setJumlahPorsi(e.target.value)}
                      placeholder="50"
                      min="1"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Lokasi / Alamat Acara (Opsional)
                  </label>
                  <input
                    type="text"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Gedung serbaguna / rumah..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Group Bill Opsional */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              ID Grup Bill Rombongan (Opsional)
            </label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Contoh: GRP-ROMBONGAN-A"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Bill dengan ID grup yang sama dapat digabungkan saat pembayaran akhir.
            </p>
          </div>

          {/* Footer Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuka Open Bill...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Buka Bill Sekarang</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
