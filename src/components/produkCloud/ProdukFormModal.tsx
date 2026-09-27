import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  UtensilsCrossed,
  Tag,
  Percent,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
} from 'lucide-react';
import { Produk, Bahan, ItemResep, JenisProduk } from '../../types';
import { produkCloudService, hitungHargaNeto } from '../../services/cloud/produkCloudService';
import { hppCloudService, KalkulasiHPP, HppCalculationCache } from '../../services/cloud/hppCloudService';
import { formatRupiah, formatBiayaSatuan } from '../../utils/formatters';
import { ItemPickerSheet, ItemPickerOption, ItemPickerTab } from '../common/ItemPickerSheet';

interface ProdukFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (saved: Produk) => void;
  produkToEdit?: Produk | null;
  outletId: string;
  userId: string;
  allBahan: Bahan[];
  allProduk: Produk[];
}

interface FormResepRow {
  id: string;
  tipe: 'bahan' | 'sub_produk';
  refId: string; // bahanId atau subProdukId
  jumlah: string | number;
  satuan: string;
}

const KATEGORI_SUGGESTIONS = ['Makanan', 'Minuman', 'Kopi', 'Snack', 'Paket', 'Dessert', 'Bumbu & Saus', 'Komponen'];

export const ProdukFormModal: React.FC<ProdukFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  produkToEdit,
  outletId,
  userId,
  allBahan,
  allProduk,
}) => {
  const [nama, setNama] = useState('');
  const [sku, setSku] = useState('');
  const [kategori, setKategori] = useState('Makanan');
  const [hargaJual, setHargaJual] = useState<string | number>('');
  const [jenis, setJenis] = useState<JenisProduk>('menu_jual');
  const [aktif, setAktif] = useState(true);
  const [catatan, setCatatan] = useState('');
  const [hasilProduksiJumlah, setHasilProduksiJumlah] = useState<number | string>(1);
  const [hasilProduksiSatuan, setHasilProduksiSatuan] = useState<'gram' | 'ml' | 'pcs' | 'porsi'>('porsi');
  const [resepRows, setResepRows] = useState<FormResepRow[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Promo Diskon Produk State (Fase 6)
  const [tipeDiskon, setTipeDiskon] = useState<'none' | 'nominal' | 'persen'>('none');
  const [nilaiDiskon, setNilaiDiskon] = useState<string | number>('');

  // Live Kalkulasi HPP State
  const [liveKalkulasi, setLiveKalkulasi] = useState<KalkulasiHPP | null>(null);
  const [isCalculatingHpp, setIsCalculatingHpp] = useState(false);

  // State ItemPickerSheet & Simulasi Biaya Expand/Collapse (Tugas 1 & 2)
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    rowId?: string;
    tab: 'bahan' | 'sub_produk';
  }>({
    isOpen: false,
    mode: 'add',
    tab: 'bahan',
  });
  const [isSimulasiExpanded, setIsSimulasiExpanded] = useState(false);

  // Deteksi jenis asli pada mode edit untuk warning perubahan harga jual
  const originalJenis: JenisProduk = useMemo(() => {
    if (!produkToEdit) return 'menu_jual';
    return (produkToEdit.jenis === 'komponen' || produkToEdit.jenis === 'menu_jual')
      ? produkToEdit.jenis
      : 'menu_jual';
  }, [produkToEdit]);

  const showAmberChangeWarning = Boolean(
    produkToEdit && originalJenis === 'menu_jual' && jenis === 'komponen'
  );

  // Daftar calon sub-produk (exclude diri sendiri pada mode edit)
  const candidateSubProduk = useMemo(() => {
    return allProduk.filter((p) => (produkToEdit ? p.id !== produkToEdit.id : true));
  }, [allProduk, produkToEdit]);

  // Helper mendapatkan default satuan sub-produk
  const getSubDefaultSatuan = useCallback((targetSub?: Produk | null) => {
    if (targetSub?.hasilProduksi && targetSub.hasilProduksi.satuan !== 'porsi') {
      return targetSub.hasilProduksi.satuan;
    }
    return 'porsi';
  }, []);

  // Inisialisasi Form
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (produkToEdit) {
        setNama(produkToEdit.nama);
        setSku(produkToEdit.sku || '');
        setKategori(produkToEdit.kategori || 'Makanan');
        setHargaJual(produkToEdit.hargaJual);
        setJenis(
          produkToEdit.jenis === 'komponen' || produkToEdit.jenis === 'menu_jual'
            ? produkToEdit.jenis
            : 'menu_jual'
        );
        setAktif(produkToEdit.aktif);
        setCatatan(produkToEdit.catatan || '');

        if (produkToEdit.hasilProduksi && typeof produkToEdit.hasilProduksi.jumlah === 'number') {
          setHasilProduksiJumlah(produkToEdit.hasilProduksi.jumlah);
          setHasilProduksiSatuan(produkToEdit.hasilProduksi.satuan || 'porsi');
        } else {
          setHasilProduksiJumlah(1);
          setHasilProduksiSatuan('porsi');
        }

        if (produkToEdit.diskonProduk && produkToEdit.diskonProduk.nilai > 0) {
          setTipeDiskon(produkToEdit.diskonProduk.tipe);
          setNilaiDiskon(produkToEdit.diskonProduk.nilai);
        } else {
          setTipeDiskon('none');
          setNilaiDiskon('');
        }

        const mapped: FormResepRow[] = (produkToEdit.resepItems || []).map((it, idx) => {
          const isSub = Boolean(it.subProdukId || it.produkId);
          return {
            id: it.id || `row-${idx}-${Date.now()}`,
            tipe: isSub ? 'sub_produk' : 'bahan',
            refId: (it.subProdukId || it.produkId || it.bahanId || ''),
            jumlah: it.jumlah ?? it.qty ?? 1,
            satuan: it.satuan || (isSub ? 'porsi' : 'gram'),
          };
        });
        setResepRows(mapped);
      } else {
        // Mode create
        setNama('');
        setSku('');
        setKategori('Makanan');
        setHargaJual('');
        setJenis('menu_jual');
        setAktif(true);
        setCatatan('');
        setHasilProduksiJumlah(1);
        setHasilProduksiSatuan('porsi');
        setTipeDiskon('none');
        setNilaiDiskon('');
        setResepRows([]);
      }
    }
  }, [isOpen, produkToEdit]);

  // Re-kalkulasi Live HPP saat resepRows atau hargaJual berubah
  useEffect(() => {
    let isCancelled = false;

    const runLiveCalculation = async () => {
      if (!isOpen) return;

      const numHargaJual =
        jenis === 'komponen'
          ? 0
          : typeof hargaJual === 'number'
          ? hargaJual
          : parseFloat(String(hargaJual)) || 0;

      // Siapkan item resep yang valid untuk dihitung
      const itemsToCalculate: ItemResep[] = resepRows
        .filter((r) => r.refId)
        .map((r) => {
          const numJumlah =
            typeof r.jumlah === 'number'
              ? r.jumlah
              : parseFloat(String(r.jumlah)) || 0;

          return {
            bahanId: r.tipe === 'bahan' ? r.refId : undefined,
            subProdukId: r.tipe === 'sub_produk' ? r.refId : undefined,
            jumlah: numJumlah,
            satuan: r.satuan,
          };
        });

      if (itemsToCalculate.length === 0) {
        setLiveKalkulasi({
          hpp: 0,
          hargaJual: numHargaJual,
          estimasiProfit: numHargaJual,
          marginPersen: numHargaJual > 0 ? 100 : 0,
          isResepKosong: true,
          adaBahanTanpaBiaya: false,
          bahanTanpaBiayaList: [],
          itemsDetail: [],
          hasCycleError: false,
        });
        return;
      }

      try {
        setIsCalculatingHpp(true);
        // Buat cache dari props agar kalkulasi instan tanpa fetch ulang
        const cache: HppCalculationCache = {
          bahanMap: new Map(allBahan.map((b) => [b.id, b])),
          produkMap: new Map(allProduk.map((p) => [p.id, p])),
        };

        const result = await hppCloudService.hitungHppDariResepItems(
          outletId,
          itemsToCalculate,
          numHargaJual,
          cache
        );

        if (!isCancelled) {
          setLiveKalkulasi(result);
        }
      } catch (err) {
        console.error('[ProdukFormModal] Gagal kalkulasi live HPP:', err);
      } finally {
        if (!isCancelled) {
          setIsCalculatingHpp(false);
        }
      }
    };

    const timer = setTimeout(runLiveCalculation, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, resepRows, hargaJual, jenis, allBahan, allProduk, outletId]);

  // Live Kalkulasi Promo Diskon (Fase 6)
  const numHargaJual = useMemo(() => {
    return jenis === 'komponen' ? 0 : typeof hargaJual === 'number' ? hargaJual : parseFloat(String(hargaJual)) || 0;
  }, [jenis, hargaJual]);

  const numNilaiDiskon = useMemo(() => {
    return typeof nilaiDiskon === 'number' ? nilaiDiskon : parseFloat(String(nilaiDiskon)) || 0;
  }, [nilaiDiskon]);

  const diskonPayload = useMemo(() => {
    if (tipeDiskon === 'none' || numNilaiDiskon <= 0) return undefined;
    return { tipe: tipeDiskon, nilai: numNilaiDiskon };
  }, [tipeDiskon, numNilaiDiskon]);

  const { hargaNeto: liveHargaNeto, diskonNominal: liveDiskonNominal } = useMemo(() => {
    return hitungHargaNeto(numHargaJual, diskonPayload);
  }, [numHargaJual, diskonPayload]);

  // Peringatan amber bila harga efektif < HPP resep
  const isHargaEfektifUnderHpp = useMemo(() => {
    if (jenis !== 'menu_jual' || !liveKalkulasi?.hpp || liveKalkulasi.hpp <= 0) return false;
    if (tipeDiskon === 'none' || liveDiskonNominal <= 0) return false;
    return liveHargaNeto < liveKalkulasi.hpp;
  }, [jenis, liveKalkulasi?.hpp, tipeDiskon, liveDiskonNominal, liveHargaNeto]);

  // Deteksi Baris Resep Duplikat (item sama lebih dari satu)
  const duplicateInfo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resepRows) {
      if (!r.refId) continue;
      const key = `${r.tipe}:${r.refId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let excessCount = 0;
    for (const count of counts.values()) {
      if (count > 1) {
        excessCount += count - 1;
      }
    }
    return { hasDuplicate: excessCount > 0, count: excessCount };
  }, [resepRows]);

  // Handler Gabungkan Baris Duplikat (menjumlahkan takaran ke baris pertama & hapus sisanya)
  const handleMergeDuplicates = () => {
    const mergedMap = new Map<string, FormResepRow>();
    const newRows: FormResepRow[] = [];

    for (const row of resepRows) {
      if (!row.refId) {
        newRows.push(row);
        continue;
      }
      const key = `${row.tipe}:${row.refId}`;
      if (!mergedMap.has(key)) {
        const cloned = { ...row };
        mergedMap.set(key, cloned);
        newRows.push(cloned);
      } else {
        const firstRow = mergedMap.get(key)!;
        const currentQty =
          typeof firstRow.jumlah === 'number'
            ? firstRow.jumlah
            : parseFloat(String(firstRow.jumlah)) || 0;
        const additionalQty =
          typeof row.jumlah === 'number'
            ? row.jumlah
            : parseFloat(String(row.jumlah)) || 0;
        firstRow.jumlah = Math.round((currentQty + additionalQty) * 1000) / 1000;
      }
    }

    setResepRows(newRows);
  };

  // Tabs ItemPickerSheet
  const pickerTabs: ItemPickerTab[] = useMemo(
    () => [
      { id: 'bahan', label: 'Bahan Baku', count: allBahan.length },
      { id: 'sub_produk', label: 'Sub-Produk', count: candidateSubProduk.length },
    ],
    [allBahan.length, candidateSubProduk.length]
  );

  // Items untuk ItemPickerSheet
  // Mode tambah: item yang sudah dipakai baris lain disabled berlabel "sudah dipakai".
  // Mode ganti: item baris itu sendiri tidak disabled, item baris lain tetap disabled.
  const pickerItems: ItemPickerOption[] = useMemo(() => {
    if (pickerState.tab === 'bahan') {
      return allBahan.map((b) => {
        const isUsedInOtherRow = resepRows.some((r) => {
          if (pickerState.mode === 'edit' && r.id === pickerState.rowId) {
            return false;
          }
          return r.tipe === 'bahan' && r.refId === b.id;
        });

        return {
          id: b.id,
          label: b.nama,
          sublabel: `Acuan: ${formatBiayaSatuan(b.hargaPerSatuanDasar, b.satuanDasar)} · Satuan: ${b.satuanDasar}`,
          badge: 'Bahan Baku',
          badgeColor: 'orange',
          disabled: isUsedInOtherRow,
          disabledLabel: 'sudah dipakai',
        };
      });
    } else {
      return candidateSubProduk.map((p) => {
        const isUsedInOtherRow = resepRows.some((r) => {
          if (pickerState.mode === 'edit' && r.id === pickerState.rowId) {
            return false;
          }
          return r.tipe === 'sub_produk' && r.refId === p.id;
        });

        const outputStr = p.hasilProduksi
          ? `${p.hasilProduksi.jumlah} ${p.hasilProduksi.satuan}`
          : '1 porsi';

        return {
          id: p.id,
          label: p.nama,
          sublabel: `Output: ${outputStr} · Kategori: ${p.kategori || '-'}`,
          badge: 'Sub-Produk',
          badgeColor: 'purple',
          disabled: isUsedInOtherRow,
          disabledLabel: 'sudah dipakai',
        };
      });
    }
  }, [
    pickerState.tab,
    pickerState.mode,
    pickerState.rowId,
    allBahan,
    candidateSubProduk,
    resepRows,
  ]);

  // Handler onSelect dari ItemPickerSheet
  const handlePickerSelect = (selectedId: string) => {
    if (pickerState.mode === 'add') {
      if (pickerState.tab === 'bahan') {
        const selectedBahan = allBahan.find((b) => b.id === selectedId);
        const newRow: FormResepRow = {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tipe: 'bahan',
          refId: selectedId,
          jumlah: 1,
          satuan: selectedBahan ? selectedBahan.satuanDasar : 'gram',
        };
        setResepRows((prev) => [...prev, newRow]);
      } else {
        const selectedSub = candidateSubProduk.find((p) => p.id === selectedId);
        const defaultSat = getSubDefaultSatuan(selectedSub);
        const newRow: FormResepRow = {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tipe: 'sub_produk',
          refId: selectedId,
          jumlah: 1,
          satuan: defaultSat,
        };
        setResepRows((prev) => [...prev, newRow]);
      }
    } else if (pickerState.mode === 'edit' && pickerState.rowId) {
      setResepRows((prev) =>
        prev.map((r) => {
          if (r.id !== pickerState.rowId) return r;
          if (pickerState.tab === 'bahan') {
            const targetBahan = allBahan.find((b) => b.id === selectedId);
            return {
              ...r,
              tipe: 'bahan',
              refId: selectedId,
              satuan: targetBahan ? targetBahan.satuanDasar : r.satuan,
            };
          } else {
            const targetSub = candidateSubProduk.find((p) => p.id === selectedId);
            const defaultSat = getSubDefaultSatuan(targetSub);
            return {
              ...r,
              tipe: 'sub_produk',
              refId: selectedId,
              satuan: defaultSat,
            };
          }
        })
      );
    }
  };

  // Handler Tambah Baris Bahan
  const handleAddBahanRow = () => {
    if (allBahan.length === 0) {
      setErrorMsg('Belum ada bahan baku terdaftar di outlet. Tambahkan bahan terlebih dahulu.');
      return;
    }
    setPickerState({
      isOpen: true,
      mode: 'add',
      tab: 'bahan',
    });
  };

  // Handler Tambah Baris Sub-Produk
  const handleAddSubProdukRow = () => {
    if (candidateSubProduk.length === 0) {
      setErrorMsg('Belum ada produk lain yang dapat dijadikan sub-resep.');
      return;
    }
    setPickerState({
      isOpen: true,
      mode: 'add',
      tab: 'sub_produk',
    });
  };

  // Hapus Baris
  const handleRemoveRow = (id: string) => {
    setResepRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Update Tipe Baris (Bahan <-> Sub-Produk)
  const handleRowTypeChange = (id: string, newType: 'bahan' | 'sub_produk') => {
    setResepRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (newType === 'bahan') {
          const firstBahan = allBahan[0];
          return {
            ...r,
            tipe: 'bahan',
            refId: firstBahan ? firstBahan.id : '',
            satuan: firstBahan ? firstBahan.satuanDasar : 'gram',
          };
        } else {
          const firstSub = candidateSubProduk[0];
          const defaultSat = getSubDefaultSatuan(firstSub);
          return {
            ...r,
            tipe: 'sub_produk',
            refId: firstSub ? firstSub.id : '',
            satuan: defaultSat,
          };
        }
      })
    );
  };

  // Update Item Terpilih (refId)
  const handleRowItemChange = (id: string, newRefId: string) => {
    setResepRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.tipe === 'bahan') {
          const targetBahan = allBahan.find((b) => b.id === newRefId);
          return {
            ...r,
            refId: newRefId,
            satuan: targetBahan ? targetBahan.satuanDasar : r.satuan,
          };
        } else {
          const targetSub = candidateSubProduk.find((p) => p.id === newRefId);
          const defaultSat = getSubDefaultSatuan(targetSub);
          return {
            ...r,
            refId: newRefId,
            satuan: defaultSat,
          };
        }
      })
    );
  };

  // Update Satuan Baris Resep
  const handleRowSatuanChange = (id: string, newSatuan: string) => {
    setResepRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, satuan: newSatuan } : r))
    );
  };

  // Update Jumlah Pemakaian
  const handleRowJumlahChange = (id: string, val: string) => {
    setResepRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, jumlah: val } : r))
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedNama = nama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      setErrorMsg(
        jenis === 'komponen'
          ? 'Nama komponen wajib diisi minimal 2 karakter.'
          : 'Nama produk menu wajib diisi minimal 2 karakter.'
      );
      return;
    }

    let numHargaJual = 0;
    if (jenis === 'menu_jual') {
      const parsed =
        typeof hargaJual === 'number'
          ? hargaJual
          : parseFloat(String(hargaJual));

      if (isNaN(parsed) || parsed <= 0) {
        setErrorMsg('Harga jual menu wajib lebih dari 0.');
        return;
      }
      numHargaJual = parsed;
    }

    // Validasi Promo Diskon Produk (Fase 6)
    let payloadDiskon: { tipe: 'nominal' | 'persen'; nilai: number } | null = null;
    if (jenis === 'menu_jual' && tipeDiskon !== 'none') {
      const numNilai = typeof nilaiDiskon === 'number' ? nilaiDiskon : parseFloat(String(nilaiDiskon));
      if (isNaN(numNilai) || numNilai <= 0) {
        setErrorMsg('Nilai diskon promo harus lebih dari 0.');
        return;
      }
      if (tipeDiskon === 'nominal') {
        if (numNilai < 0) {
          setErrorMsg('Diskon nominal tidak boleh negatif.');
          return;
        }
        if (numNilai > numHargaJual) {
          setErrorMsg(`Diskon nominal tidak boleh melebihi harga jual (maks Rp${numHargaJual.toLocaleString('id-ID')}).`);
          return;
        }
      } else if (tipeDiskon === 'persen') {
        if (numNilai < 0) {
          setErrorMsg('Diskon persen tidak boleh negatif.');
          return;
        }
        if (numNilai > 90) {
          setErrorMsg('Diskon persen maksimal 90%.');
          return;
        }
      }
      payloadDiskon = {
        tipe: tipeDiskon,
        nilai: numNilai,
      };
    }

    const numHasilProduksi =
      typeof hasilProduksiJumlah === 'number'
        ? hasilProduksiJumlah
        : parseFloat(String(hasilProduksiJumlah));

    if (isNaN(numHasilProduksi) || numHasilProduksi <= 0) {
      setErrorMsg('Jumlah hasil produksi wajib lebih dari 0.');
      return;
    }

    const payloadHasilProduksi = {
      jumlah: numHasilProduksi,
      satuan: hasilProduksiSatuan,
    };

    // Validasi baris resep
    const validatedItems: ItemResep[] = [];
    for (let i = 0; i < resepRows.length; i++) {
      const row = resepRows[i];
      if (!row.refId) {
        setErrorMsg(`Baris resep ke-${i + 1} belum memilih bahan atau sub-produk.`);
        return;
      }

      const numJumlah =
        typeof row.jumlah === 'number'
          ? row.jumlah
          : parseFloat(String(row.jumlah));

      if (isNaN(numJumlah) || numJumlah <= 0) {
        setErrorMsg(`Jumlah takaran pada baris ke-${i + 1} harus lebih dari 0.`);
        return;
      }

      validatedItems.push({
        bahanId: row.tipe === 'bahan' ? row.refId : undefined,
        subProdukId: row.tipe === 'sub_produk' ? row.refId : undefined,
        jumlah: numJumlah,
        satuan: row.satuan,
      });
    }

    // Guard siklus sinkron saat submit SEBELUM menyimpan ke Firestore
    try {
      const submitCache: HppCalculationCache = {
        bahanMap: new Map(allBahan.map((b) => [b.id, b])),
        produkMap: new Map(allProduk.map((p) => [p.id, p])),
      };

      const checkKalkulasi = await hppCloudService.hitungHppDariResepItems(
        outletId,
        validatedItems,
        numHargaJual,
        submitCache
      );

      if (checkKalkulasi.hasCycleError) {
        setErrorMsg(checkKalkulasi.cycleErrorMessage || 'Resep memuat siklus ketergantungan!');
        return;
      }
    } catch (calcErr) {
      console.error('[ProdukFormModal] Gagal verifikasi siklus resep saat submit:', calcErr);
    }

    try {
      setIsSubmitting(true);
      const finalSku = sku.trim() || undefined;

      if (produkToEdit) {
        await produkCloudService.updateProduk(
          outletId,
          produkToEdit.id,
          {
            nama: trimmedNama,
            kategori: kategori.trim() || 'Umum',
            sku: finalSku,
            hargaJual: jenis === 'komponen' ? 0 : numHargaJual,
            jenis,
            aktif,
            resepItems: validatedItems,
            catatan: catatan.trim() || undefined,
            hasilProduksi: payloadHasilProduksi,
            diskonProduk: payloadDiskon,
          },
          userId
        );

        const updated: Produk = {
          ...produkToEdit,
          nama: trimmedNama,
          kategori: kategori.trim() || 'Umum',
          sku: finalSku,
          hargaJual: jenis === 'komponen' ? 0 : numHargaJual,
          jenis,
          aktif,
          resepItems: validatedItems,
          catatan: catatan.trim() || undefined,
          hasilProduksi: payloadHasilProduksi,
          diskonProduk: payloadDiskon || undefined,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        };

        onSuccess(updated);
      } else {
        const created = await produkCloudService.createProduk(
          outletId,
          {
            nama: trimmedNama,
            kategori: kategori.trim() || 'Umum',
            sku: finalSku,
            hargaJual: jenis === 'komponen' ? 0 : numHargaJual,
            jenis,
            aktif,
            resepItems: validatedItems,
            catatan: catatan.trim() || undefined,
            hasilProduksi: payloadHasilProduksi,
            diskonProduk: payloadDiskon || undefined,
          },
          userId
        );

        onSuccess(created);
      }
    } catch (err: unknown) {
      console.error('[ProdukFormModal] Gagal menyimpan produk:', err);
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan produk.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper format biaya unit (misal: Rp40,042/gram atau Rp43.600/porsi)
  const formatBiayaUnit = (biaya: number, satuan: string): string => {
    if (!biaya || isNaN(biaya) || biaya <= 0) return `Rp0/${satuan}`;
    const isInteger = Number.isInteger(biaya);
    const maxDecimals = satuan === 'gram' || satuan === 'ml' ? 3 : 2;
    const formattedNominal = isInteger
      ? formatRupiah(biaya)
      : `Rp${biaya.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: maxDecimals })}`;
    return `${formattedNominal}/${satuan}`;
  };

  // Helper warna badge margin
  const getMarginBadgeClass = (margin: number) => {
    if (margin >= 40) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    }
    if (margin >= 20) {
      return 'bg-amber-50 text-amber-700 border-amber-300';
    }
    return 'bg-rose-50 text-rose-700 border-rose-300';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              {produkToEdit
                ? jenis === 'komponen'
                  ? 'Edit Komponen Dapur'
                  : 'Edit Produk Menu'
                : jenis === 'komponen'
                ? 'Tambah Komponen Dapur'
                : 'Tambah Produk Menu'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {jenis === 'komponen'
                ? 'Atur hasil batch, racikan resep, dan kalkulasi biaya per satuan sub-bahan'
                : 'Atur harga jual, kategori, status aktif, dan racikan resep multi-level'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Pemilih Jenis Produk (Segmented Control Dua Tombol Besar) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">Jenis Produk</label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-100 rounded-2xl border border-stone-200">
              <button
                type="button"
                onClick={() => setJenis('menu_jual')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                  jenis === 'menu_jual'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 ring-1 ring-orange-500/20'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                <span>Menu Jual</span>
              </button>

              <button
                type="button"
                onClick={() => setJenis('komponen')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                  jenis === 'komponen'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 ring-1 ring-amber-500/20'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Package className="w-4 h-4 text-amber-600" />
                <span>Komponen Dapur</span>
              </button>
            </div>

            {showAmberChangeWarning && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Harga jual lama akan dibuang karena komponen tidak dijual langsung.</span>
              </div>
            )}
          </div>

          {/* Baris 1: Nama Produk & Status Aktif */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                {jenis === 'komponen' ? 'Nama Komponen' : 'Nama Produk Menu'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder={
                  jenis === 'komponen'
                    ? 'Contoh: Bumbu Dasar Kuning, Nasi Gurih Dandang, Kaldu Ayam'
                    : 'Contoh: Kopi Susu Gula Aren, Ayam Goreng Lengkuas'
                }
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition disabled:bg-stone-50"
              />
            </div>

            {/* Toggle Status Aktif */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Status Penjualan</label>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setAktif(!aktif)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                  aktif
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-stone-100 border-stone-300 text-stone-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${aktif ? 'bg-emerald-500' : 'bg-stone-400'}`}
                />
                <span>{aktif ? 'Menu Aktif' : 'Nonaktif'}</span>
              </button>
            </div>
          </div>

          {/* Baris 2: Kategori & Harga Jual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Kategori */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Kategori Produk
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                placeholder="Pilih atau ketik kategori..."
                className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {KATEGORI_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setKategori(sug)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition ${
                      kategori.toLowerCase() === sug.toLowerCase()
                        ? 'bg-orange-50 border-orange-400 text-orange-700'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Harga Jual (hanya untuk menu_jual) ATAU Catatan Info Komponen */}
            {jenis === 'menu_jual' ? (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Harga Jual (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    disabled={isSubmitting}
                    value={hargaJual}
                    onChange={(e) => setHargaJual(e.target.value)}
                    placeholder="25000"
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
                  />
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Harga di kasir POS sebelum diskon
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Komponen tidak dijual langsung di kasir. Untuk menjualnya per porsi, buat menu jual terpisah yang memakai komponen ini sebagai sub-produk.
                </div>
              </div>
            )}
          </div>

          {/* Section: Promo Diskon Produk (Opsional) */}
          {jenis === 'menu_jual' && (
            <div className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 leading-tight">
                      Promo Diskon Produk <span className="text-[11px] font-normal text-stone-400">(Opsional)</span>
                    </h4>
                    <p className="text-[10px] text-stone-500">
                      Diskon langsung per unit produk saat dipilih di kasir
                    </p>
                  </div>
                </div>
              </div>

              {/* Pilihan Radio Tipe Diskon */}
              <div className="grid grid-cols-3 gap-2">
                <label
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                    tipeDiskon === 'none'
                      ? 'bg-white border-orange-500 text-orange-700 shadow-2xs font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="promo_tipe_diskon"
                    value="none"
                    checked={tipeDiskon === 'none'}
                    onChange={() => {
                      setTipeDiskon('none');
                      setNilaiDiskon('');
                    }}
                    className="sr-only"
                  />
                  <span>Tanpa diskon</span>
                </label>

                <label
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                    tipeDiskon === 'nominal'
                      ? 'bg-white border-orange-500 text-orange-700 shadow-2xs font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="promo_tipe_diskon"
                    value="nominal"
                    checked={tipeDiskon === 'nominal'}
                    onChange={() => setTipeDiskon('nominal')}
                    className="sr-only"
                  />
                  <span>Nominal Rp per unit</span>
                </label>

                <label
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                    tipeDiskon === 'persen'
                      ? 'bg-white border-orange-500 text-orange-700 shadow-2xs font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="promo_tipe_diskon"
                    value="persen"
                    checked={tipeDiskon === 'persen'}
                    onChange={() => setTipeDiskon('persen')}
                    className="sr-only"
                  />
                  <span>Persen % dari harga</span>
                </label>
              </div>

              {/* Input Nilai Diskon jika Nominal / Persen dipilih */}
              {tipeDiskon !== 'none' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        {tipeDiskon === 'nominal' ? 'Besar Diskon per Unit (Rp)' : 'Besar Diskon (%)'}
                      </label>
                      <div className="relative">
                        {tipeDiskon === 'nominal' ? (
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                            Rp
                          </span>
                        ) : (
                          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                            %
                          </span>
                        )}
                        <input
                          type="number"
                          min="1"
                          max={tipeDiskon === 'persen' ? 90 : numHargaJual}
                          step="any"
                          disabled={isSubmitting}
                          value={nilaiDiskon}
                          onChange={(e) => setNilaiDiskon(e.target.value)}
                          placeholder={tipeDiskon === 'nominal' ? '1000' : '10'}
                          className={`w-full py-2 rounded-xl text-xs sm:text-sm font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition ${
                            tipeDiskon === 'nominal' ? 'pl-9 pr-3' : 'pl-3 pr-8'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-stone-400 mt-0.5 block">
                        {tipeDiskon === 'persen' ? 'Maksimal 90%' : `Maksimal Rp${numHargaJual.toLocaleString('id-ID')}`}
                      </span>
                    </div>

                    {/* Info Live Harga Efektif */}
                    <div className="w-full sm:w-1/2 p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                      <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                        Ringkasan Harga
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-emerald-700 font-mono">
                          Harga efektif: {formatRupiah(liveHargaNeto)}
                        </span>
                        {liveDiskonNominal > 0 && numHargaJual > 0 && (
                          <span className="text-xs text-stone-400 line-through font-mono">
                            {formatRupiah(numHargaJual)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        Hemat {formatRupiah(liveDiskonNominal)} per porsi
                      </div>
                    </div>
                  </div>

                  {/* Peringatan Amber otomatis jika harga efektif < HPP batch */}
                  {isHargaEfektifUnderHpp && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-bold">Peringatan Margin Negatif:</span> Harga efektif ({formatRupiah(liveHargaNeto)}) lebih rendah dari estimasi HPP resep ({formatRupiah(liveKalkulasi?.hpp || 0)}). Penjualan menu ini berpotensi menyebabkan kerugian.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Baris SKU (Override Manual Opsional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700">
                SKU Produk <span className="text-[11px] font-normal text-stone-400">(Opsional)</span>
              </label>
              <span className="text-[10px] text-stone-400">
                Kosongkan untuk generate otomatis
              </span>
            </div>
            <input
              type="text"
              disabled={isSubmitting}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder={jenis === 'komponen' ? 'Auto: KMP-YYYYMMDD-XXX' : 'Auto: MNU-YYYYMMDD-XXX'}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition disabled:bg-stone-50"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Biarkan kosong jika ingin sistem membuat SKU unik otomatis saat disimpan ({jenis === 'komponen' ? 'KMP-YYYYMMDD-XXX' : 'MNU-YYYYMMDD-XXX'}).
            </p>
          </div>

          {/* Section: Hasil Produksi per 1 Kali Masak (Output Batch) */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Hasil Produksi per 1 Kali Masak (Output Batch)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Jumlah Output <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  disabled={isSubmitting}
                  value={hasilProduksiJumlah}
                  onChange={(e) => setHasilProduksiJumlah(e.target.value)}
                  placeholder="Contoh: 1000 atau 1"
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white transition"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Satuan Output
                </label>
                <select
                  disabled={isSubmitting}
                  value={hasilProduksiSatuan}
                  onChange={(e) =>
                    setHasilProduksiSatuan(e.target.value as 'gram' | 'ml' | 'pcs' | 'porsi')
                  }
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white transition"
                >
                  <option value="porsi">porsi (Menu porsi satuan)</option>
                  <option value="gram">gram (Bumbu / Komponen padat)</option>
                  <option value="ml">ml (Saus / Kaldu / Komponen cair)</option>
                  <option value="pcs">pcs (Komponen potongan / satuan)</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Satu kali masak resep ini menghasilkan jumlah tersebut. Nilai ini dipakai saat produk ini digunakan sebagai sub-bahan oleh menu lain.
            </p>
          </div>

          {/* Info SKU Sistem */}
          {produkToEdit?.sku ? (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-500 font-medium">SKU Terdaftar:</span>
              <span className="font-mono font-bold text-stone-800">{produkToEdit.sku}</span>
            </div>
          ) : (
            <div className="text-[11px] text-stone-400 italic">
              * SKU unik akan otomatis dibuat oleh sistem saat disimpan (format: {jenis === 'komponen' ? 'KMP' : 'MNU'}-YYYYMMDD-XXX).
            </div>
          )}

          {/* ================= RESEP BUILDER SECTION ================= */}
          <div className="pt-3 border-t border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <span>Resep & Takaran Bahan</span>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-bold">
                    {resepRows.length} item
                  </span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  Resep mendukung bahan baku mentah dan sub-produk racikan bertingkat
                </p>
              </div>
            </div>

            {/* Banner Duplikat Baris (Mode Edit / Deteksi Otomatis) */}
            {duplicateInfo.hasDuplicate && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Ada {duplicateInfo.count} baris duplikat.</span>
                </div>
                <button
                  type="button"
                  onClick={handleMergeDuplicates}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shrink-0 active:scale-95 shadow-2xs"
                >
                  Gabungkan
                </button>
              </div>
            )}

            {/* List Baris Resep Ringkas Dua Tingkat */}
            {resepRows.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-stone-200 text-center bg-stone-50/50">
                <p className="text-xs text-stone-400">
                  Produk ini belum memiliki takaran resep. Ketuk <strong>+ Bahan</strong> atau{' '}
                  <strong>+ Sub-Produk</strong> di bilah bawah untuk menambahkan racikan.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {resepRows.map((row, idx) => {
                  const isBahan = row.tipe === 'bahan';
                  const selectedBahan = isBahan
                    ? allBahan.find((b) => b.id === row.refId)
                    : null;
                  const selectedSub = !isBahan
                    ? candidateSubProduk.find((p) => p.id === row.refId)
                    : null;

                  // Hitung detailIndex per baris
                  const detailIndex = resepRows.slice(0, idx).filter((r) => Boolean(r.refId)).length;
                  const rowDetail = row.refId ? liveKalkulasi?.itemsDetail?.[detailIndex] : undefined;
                  const subtotalBiaya = rowDetail?.subtotalBiaya ?? 0;
                  const hasBiaya = rowDetail ? rowDetail.hasBiaya : true;

                  const itemName = isBahan
                    ? selectedBahan?.nama || 'Pilih Bahan Baku'
                    : selectedSub?.nama || 'Pilih Sub-Produk';

                  const itemSubtext = isBahan
                    ? selectedBahan
                      ? `Acuan: ${formatBiayaSatuan(selectedBahan.hargaPerSatuanDasar, selectedBahan.satuanDasar)}`
                      : ''
                    : selectedSub?.hasilProduksi
                    ? `Output: ${selectedSub.hasilProduksi.jumlah} ${selectedSub.hasilProduksi.satuan}`
                    : '';

                  return (
                    <div
                      key={row.id}
                      className="p-3 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-2 hover:border-stone-300 transition"
                    >
                      {/* Tingkat 1: Nama Item + Biaya Baris */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap flex-1">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                              isBahan
                                ? 'bg-orange-50 text-orange-800 border-orange-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {isBahan ? <Package className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                            <span>{isBahan ? 'Bahan' : 'Sub'}</span>
                          </span>

                          <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                            {itemName}
                          </span>

                          {itemSubtext && (
                            <span className="text-[10px] text-stone-400 font-medium hidden sm:inline">
                              ({itemSubtext})
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs sm:text-sm font-black text-stone-900 font-mono">
                            {formatRupiah(subtotalBiaya)}
                          </span>
                        </div>
                      </div>

                      {/* Tingkat 2: Input Takaran Kecil + Satuan + Tombol Ikon Ganti + Tombol Hapus */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.jumlah}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onChange={(e) => handleRowJumlahChange(row.id, e.target.value)}
                            placeholder="Qty"
                            className="w-20 px-2 py-1 rounded-lg text-xs border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-stone-50/70 font-bold text-center text-stone-900"
                          />

                          {isBahan ? (
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-bold text-stone-600 px-1"
                            >
                              {row.satuan}
                            </span>
                          ) : (
                            (() => {
                              const subSatuanOptions =
                                selectedSub?.hasilProduksi && selectedSub.hasilProduksi.satuan !== 'porsi'
                                  ? [selectedSub.hasilProduksi.satuan, 'porsi']
                                  : ['porsi'];
                              const isLocked = subSatuanOptions.length <= 1;

                              return (
                                <select
                                  value={row.satuan}
                                  disabled={isSubmitting || isLocked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleRowSatuanChange(row.id, e.target.value)}
                                  className="px-2 py-1 rounded-lg text-xs border border-stone-200 bg-stone-50 font-bold text-stone-700 disabled:bg-stone-100 disabled:text-stone-400 shrink-0 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                  {subSatuanOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Tombol Ikon Ganti: membuka ItemPickerSheet mode ganti */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickerState({
                                isOpen: true,
                                mode: 'edit',
                                rowId: row.id,
                                tab: row.tipe,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:scale-95 transition"
                            title="Ganti item bahan / sub-produk"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
                            <span>Ganti</span>
                          </button>

                          {/* Tombol Hapus Baris */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveRow(row.id);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition"
                            title="Hapus baris resep"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Warning jika item belum punya biaya */}
                      {!hasBiaya && (
                        <div className="text-[10px] text-amber-700 flex items-center gap-1 pt-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Biaya acuan item ini masih Rp0. HPP belum akurat.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bilah Lengket di Bagian Bawah Section Resep: Tombol Tambah + Bilah Simulasi Biaya */}
            <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-xs -mx-5 px-5 py-2.5 border-t border-stone-200/80 shadow-md space-y-2">
              {/* Bilah Tombol Tambah */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddBahanRow}
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition active:scale-98"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>+ Bahan</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddSubProdukRow}
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition active:scale-98"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>+ Sub-Produk</span>
                </button>
              </div>

              {/* Bilah Lengket Satu Baris: Simulasi Biaya (Ketuk Melebar Menjadi Panel Penuh) */}
              <div className="rounded-xl bg-stone-900 text-white shadow-md overflow-hidden transition-all duration-200 border border-stone-800">
                {/* Header Satu Baris Lengket */}
                <button
                  type="button"
                  onClick={() => setIsSimulasiExpanded((prev) => !prev)}
                  className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-stone-800/80 transition"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1 truncate text-xs">
                      {jenis === 'komponen' ? (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-stone-400 text-[11px]">Total HPP:</span>
                          <span className="font-black text-white font-mono">
                            {formatRupiah(liveKalkulasi?.hpp || 0)}
                          </span>
                          <span className="text-stone-500 text-[10px]">·</span>
                          <span className="text-stone-400 text-[11px]">Biaya/satuan:</span>
                          <span className="font-bold text-emerald-400 font-mono text-[11px]">
                            {(() => {
                              const numOut =
                                typeof hasilProduksiJumlah === 'number'
                                  ? hasilProduksiJumlah
                                  : parseFloat(String(hasilProduksiJumlah)) || 1;
                              const safeOut = numOut > 0 ? numOut : 1;
                              const perSat = (liveKalkulasi?.hpp || 0) / safeOut;
                              return formatBiayaUnit(perSat, hasilProduksiSatuan);
                            })()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-stone-400 text-[11px]">Total HPP:</span>
                          <span className="font-black text-white font-mono">
                            {formatRupiah(liveKalkulasi?.hpp || 0)}
                          </span>
                          <span className="text-stone-500 text-[10px]">·</span>
                          <span className="text-stone-400 text-[11px]">Margin:</span>
                          <span className="font-bold text-emerald-400 text-[11px]">
                            {liveKalkulasi?.isResepKosong ? '—' : `${liveKalkulasi?.marginPersen ?? 0}%`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-stone-400">
                    {isCalculatingHpp && <Loader2 className="w-3 h-3 animate-spin text-orange-400" />}
                    <span className="text-[10px] text-stone-400 hidden sm:inline">
                      {isSimulasiExpanded ? 'Tutup' : 'Rincian'}
                    </span>
                    {isSimulasiExpanded ? (
                      <ChevronUp className="w-4 h-4 text-stone-300" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-300" />
                    )}
                  </div>
                </button>

                {/* Panel Penuh Saat Diperluas */}
                {isSimulasiExpanded && (
                  <div className="p-3.5 border-t border-stone-800 space-y-3 animate-in fade-in duration-150">
                    {jenis === 'komponen' ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-stone-400">Total HPP Batch</div>
                          <div className="text-xs sm:text-sm font-black text-white mt-0.5 font-mono">
                            {formatRupiah(liveKalkulasi?.hpp || 0)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-stone-400">Output 1 Batch</div>
                          <div className="text-xs sm:text-sm font-black text-amber-400 mt-0.5">
                            {hasilProduksiJumlah || 1} {hasilProduksiSatuan}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-stone-400">Biaya per Satuan</div>
                          <div className="text-xs sm:text-sm font-black text-emerald-400 mt-0.5 font-mono">
                            {(() => {
                              const numOut =
                                typeof hasilProduksiJumlah === 'number'
                                  ? hasilProduksiJumlah
                                  : parseFloat(String(hasilProduksiJumlah)) || 1;
                              const safeOut = numOut > 0 ? numOut : 1;
                              const perSat = (liveKalkulasi?.hpp || 0) / safeOut;
                              return formatBiayaUnit(perSat, hasilProduksiSatuan);
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-stone-400">Total HPP</div>
                          <div className="text-xs sm:text-sm font-black text-white mt-0.5 font-mono">
                            {formatRupiah(liveKalkulasi?.hpp || 0)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-stone-400">Estimasi Laba</div>
                          <div className="text-xs sm:text-sm font-black text-emerald-400 mt-0.5 font-mono">
                            {formatRupiah(liveKalkulasi?.estimasiProfit || 0)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-stone-400">Margin Produk</div>
                          <div className="mt-0.5">
                            {liveKalkulasi?.isResepKosong ? (
                              <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-black border border-stone-700 bg-stone-800 text-stone-300">
                                —
                              </span>
                            ) : (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-black border ${getMarginBadgeClass(
                                  liveKalkulasi?.marginPersen || 0
                                )}`}
                              >
                                {liveKalkulasi?.marginPersen ?? 0}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Catatan resep belum diisi */}
                    {liveKalkulasi?.isResepKosong && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>Resep belum diisi — HPP dan margin belum dihitung.</div>
                      </div>
                    )}

                    {/* Warning bila ada bahan tanpa biaya */}
                    {!liveKalkulasi?.isResepKosong && liveKalkulasi?.adaBahanTanpaBiaya && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Perhatian:</span> Beberapa bahan belum memiliki harga acuan (
                          {liveKalkulasi.bahanTanpaBiayaList.join(', ')}). HPP dihitung tanpa bahan tersebut.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Catatan Produk */}
          <div className="pt-2 border-t border-stone-100">
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Catatan Menu (Opsional)
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan cara penyajian, varian, atau catatan kasir..."
              className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition resize-none disabled:bg-stone-50"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {produkToEdit
                ? 'Simpan Perubahan'
                : jenis === 'komponen'
                ? 'Simpan Komponen'
                : 'Simpan Menu'}
            </span>
          </button>
        </div>
      </div>

      {/* ItemPickerSheet untuk Memilih / Mengganti Bahan Baku & Sub-Produk */}
      <ItemPickerSheet
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState((prev) => ({ ...prev, isOpen: false }))}
        title={
          pickerState.mode === 'add'
            ? pickerState.tab === 'bahan'
              ? 'Tambah Bahan Baku'
              : 'Tambah Sub-Produk'
            : pickerState.tab === 'bahan'
            ? 'Ganti Bahan Baku'
            : 'Ganti Sub-Produk'
        }
        tabs={pickerTabs}
        activeTab={pickerState.tab}
        onTabChange={(tabId) =>
          setPickerState((prev) => ({
            ...prev,
            tab: tabId as 'bahan' | 'sub_produk',
          }))
        }
        items={pickerItems}
        onSelect={handlePickerSelect}
        searchPlaceholder={
          pickerState.tab === 'bahan'
            ? 'Cari nama bahan baku...'
            : 'Cari nama sub-produk...'
        }
      />
    </div>
  );
};
