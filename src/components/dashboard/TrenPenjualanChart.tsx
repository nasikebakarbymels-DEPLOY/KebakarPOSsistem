import React from 'react';
import { TrenHarianItem } from '../../services/laporanService';
import { formatRupiah, formatRupiahSingkat } from '../../utils/formatters';

interface TrenPenjualanChartProps {
  data: TrenHarianItem[];
}

export const TrenPenjualanChart: React.FC<TrenPenjualanChartProps> = ({ data }) => {
  // Cari nilai maksimum omzet atau laba untuk skala tinggi batang
  const maxNilai = Math.max(
    ...data.map((d) => Math.max(d.omzet, Math.max(0, d.labaBersih))),
    10000 // Fallback minimum skala agar tidak bagi nol
  );

  const totalOmzet7Hari = data.reduce((acc, d) => acc + d.omzet, 0);
  const totalLaba7Hari = data.reduce((acc, d) => acc + d.labaBersih, 0);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-4">
      {/* Header Grafik & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
        <div>
          <h3 className="font-extrabold text-stone-900 text-sm sm:text-base">
            Tren 7 Hari Terakhir
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Perbandingan Omzet Bersih vs Laba Bersih harian
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <span className="text-stone-600 font-medium">Omzet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-stone-600 font-medium">Laba Bersih</span>
          </div>
        </div>
      </div>

      {/* Area Grafik Bar Chart CSS Murni */}
      <div className="pt-4">
        {/* Height container untuk chart batang */}
        <div className="h-48 sm:h-56 flex items-end justify-between gap-1.5 sm:gap-3 border-b border-stone-200 pb-2 px-1">
          {data.map((item) => {
            const omzetPct = maxNilai > 0 ? Math.min(100, Math.round((item.omzet / maxNilai) * 100)) : 0;
            const labaPositif = Math.max(0, item.labaBersih);
            const labaPct = maxNilai > 0 ? Math.min(100, Math.round((labaPositif / maxNilai) * 100)) : 0;
            const isMinus = item.labaBersih < 0;

            return (
              <div
                key={item.dateStr}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip Hover / Info Popup */}
                <div className="absolute -top-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-stone-900 text-white text-[10px] rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                  <span className="font-bold">{item.dayLabel}, {item.dateLabel}</span>:
                  <div>Omzet: {formatRupiah(item.omzet)}</div>
                  <div>Laba: {formatRupiah(item.labaBersih)}</div>
                </div>

                {/* Group 2 Batang: Omzet (Orange) & Laba (Emerald) */}
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  {/* Batang Omzet */}
                  <div className="flex-1 max-w-[18px] sm:max-w-[24px] flex flex-col items-center justify-end h-full">
                    {item.omzet > 0 && (
                      <span className="text-[9px] sm:text-[10px] text-stone-500 font-bold mb-1 leading-none truncate max-w-full">
                        {formatRupiahSingkat(item.omzet)}
                      </span>
                    )}
                    <div
                      style={{ height: `${Math.max(item.omzet > 0 ? 6 : 0, omzetPct)}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        item.omzet > 0 ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-stone-100'
                      }`}
                    />
                  </div>

                  {/* Batang Laba Bersih */}
                  <div className="flex-1 max-w-[18px] sm:max-w-[24px] flex flex-col items-center justify-end h-full">
                    {labaPositif > 0 && (
                      <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold mb-1 leading-none truncate max-w-full">
                        {formatRupiahSingkat(item.labaBersih)}
                      </span>
                    )}
                    <div
                      style={{
                        height: `${
                          isMinus
                            ? 6
                            : Math.max(item.labaBersih > 0 ? 6 : 0, labaPct)
                        }%`,
                      }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isMinus
                          ? 'bg-red-400 group-hover:bg-red-500'
                          : item.labaBersih > 0
                          ? 'bg-emerald-500 group-hover:bg-emerald-600'
                          : 'bg-stone-100'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sumbu X (Label Hari & Tanggal) */}
        <div className="flex justify-between gap-1.5 sm:gap-3 pt-2 px-1">
          {data.map((item, idx) => {
            const isToday = idx === data.length - 1;
            return (
              <div
                key={item.dateStr}
                className={`flex-1 text-center truncate ${
                  isToday ? 'text-orange-600 font-extrabold' : 'text-stone-500 font-medium'
                }`}
              >
                <div className="text-[11px] sm:text-xs uppercase tracking-tight">
                  {item.dayLabel}
                </div>
                <div className="text-[9px] sm:text-[10px] opacity-75">
                  {item.dateLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Ringkasan Mini 7 Hari */}
      <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
        <div>
          Total Omzet 7 Hari: <span className="font-bold text-stone-900">{formatRupiah(totalOmzet7Hari)}</span>
        </div>
        <div>
          Total Laba 7 Hari:{' '}
          <span
            className={`font-bold ${
              totalLaba7Hari >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatRupiah(totalLaba7Hari)}
          </span>
        </div>
      </div>
    </div>
  );
};
