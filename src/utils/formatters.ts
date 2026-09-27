import { SatuanDasar, FirestoreTimestamp } from '../types';

export const formatRupiah = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val)) return 'Rp0';
  return `Rp${Math.round(val).toLocaleString('id-ID')}`;
};

// Formatter biaya per satuan dasar, mendukung 3 desimal untuk gram/ml agar presisi konsisten dengan HPP batch
export const formatBiayaSatuan = (
  biaya?: number,
  satuan?: SatuanDasar | string,
  forceDecimals?: number
): string => {
  if (biaya === undefined || biaya === null || isNaN(biaya)) {
    return 'Belum ada biaya';
  }
  
  const isInteger = Number.isInteger(biaya);
  const maxDecimals =
    forceDecimals !== undefined
      ? forceDecimals
      : satuan === 'gram' || satuan === 'ml'
      ? 3
      : 2;

  const formattedVal = isInteger
    ? Math.round(biaya).toLocaleString('id-ID')
    : biaya.toLocaleString('id-ID', {
        minimumFractionDigits: 1,
        maximumFractionDigits: maxDecimals,
      });

  return `Rp${formattedVal} /${satuan || ''}`;
};

// Helper internal untuk mengekstrak string tanggal ISO dari berbagai tipe
export const toDateString = (input?: FirestoreTimestamp | Date | null): string => {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input instanceof Date) return input.toISOString();
  if (typeof (input as any).toDate === 'function') {
    return (input as any).toDate().toISOString();
  }
  return String(input);
};

// Format tanggal YYYY-MM-DD menjadi DD/MM/YYYY
export const formatTanggalSlash = (dateInput?: FirestoreTimestamp | Date | null): string => {
  const dateStr = toDateString(dateInput);
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// Format tanggal ke gaya Indonesia: 22 Sep 2026
export const formatTanggalIndo = (dateInput?: FirestoreTimestamp | Date | null): string => {
  const dateStr = toDateString(dateInput);
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

// Format tanggal & jam ke gaya Indonesia: 22 Sep 2026, 14:30
export const formatDateTimeIndo = (dateInput?: FirestoreTimestamp | Date | null): string => {
  const isoStr = toDateString(dateInput);
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

// Format durasi relatif: "baru saja", "5 menit lalu", "2 jam lalu", "1 hari lalu"
export const formatWaktuLalu = (dateInput?: FirestoreTimestamp | Date | null): string => {
  const isoStr = toDateString(dateInput);
  if (!isoStr) return '';
  try {
    const now = Date.now();
    const then = new Date(isoStr).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

    if (diffSeconds < 60) return 'Baru saja';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  } catch {
    return isoStr;
  }
};

// Format Rupiah disingkat untuk label chart dan badge ringkas (misal: "Rp1,2jt", "Rp500rb", "Rp25rb")
export const formatRupiahSingkat = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val)) return 'Rp0';
  if (val === 0) return 'Rp0';

  const isNeg = val < 0;
  const abs = Math.abs(val);

  let str = '';
  if (abs >= 1_000_000_000) {
    str = `Rp${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}M`;
  } else if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(1).replace('.', ',');
    str = `Rp${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted}jt`;
  } else if (abs >= 1_000) {
    str = `Rp${Math.round(abs / 1_000)}rb`;
  } else {
    str = `Rp${Math.round(abs)}`;
  }

  return isNeg ? `-${str}` : str;
};

// Ambil tanggal hari ini dalam format YYYY-MM-DD
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
