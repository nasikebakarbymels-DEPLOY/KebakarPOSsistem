import React, { useState } from 'react';
import { TrenHarianItem } from '../../services/laporanService';
import { formatRupiah, formatRupiahSingkat } from '../../utils/formatters';
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';

interface ChartTren7HariProps {
  data: TrenHarianItem[];
}

export const ChartTren7Hari: React.FC<ChartTren7HariProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Cari nilai maksimum omzet dan laba untuk skala 100% grafik batang
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.omzet, Math.max(0, d.labaBersih))),
    1000 // nilai minimum default jika semua 0
  );

  const totalOmzet7Hari = data.reduce((sum, d) => sum + d.omzet, 0);
  const totalLaba7Hari = data.reduce((sum, d) => sum + d.labaBersih, 0);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-4">
      {/* Header Grafik */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Tren Performa 7 Hari Terakhir
              </h3>
              <p className="text-[11px] text-stone-500">
                Perbandingan Omzet Bersih vs Laba Bersih
              </p>
            </div>
          </div>
        </div>

        {/* Legenda & Total Ringkas */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-orange-500 inline-block" />
            <span className="text-stone-600 font-medium">Omzet</span>
            <span className="font-bold text-stone-900 ml-0.5">
              {formatRupiahSingkat(totalOmzet7Hari)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
            <span className="text-stone-600 font-medium">Laba Bersih</span>
            <span
              className={`font-bold ml-0.5 ${
                totalLaba7Hari >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatRupiahSingkat(totalLaba7Hari)}
            </span>
          </div>
        </div>
      </div>

      {/* Area Bar Chart Murni Tailwind + Flexbox */}
      <div className="relative pt-6 pb-2">
        {/* Tooltip Hover Overlay */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-stone-900/90 backdrop-blur-xs text-white text-[11px] py-1.5 px-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in zoom-in-95 pointer-events-none">
            <div>
              <span className="text-stone-400">Hari:</span>{' '}
              <span className="font-bold">
                {data[hoveredIdx].dayLabel}, {data[hoveredIdx].dateLabel}
              </span>
            </div>
            <div className="h-3 w-px bg-stone-700" />
            <div>
              <span className="text-orange-400">Omzet:</span>{' '}
              <span className="font-bold">
                {formatRupiah(data[hoveredIdx].omzet)}
              </span>
            </div>
            <div className="h-3 w-px bg-stone-700" />
            <div>
              <span className="text-emerald-400">Laba:</span>{' '}
              <span className="font-bold">
                {formatRupiah(data[hoveredIdx].labaBersih)}
              </span>
            </div>
            <div className="h-3 w-px bg-stone-700" />
            <div>
              <span className="text-stone-400">Trx:</span>{' '}
              <span className="font-bold">
                {data[hoveredIdx].jumlahTransaksi}
              </span>
            </div>
          </div>
        )}

        {/* Chart Bars Container */}
        <div className="h-44 sm:h-52 flex items-end justify-between gap-1.5 sm:gap-3 border-b border-stone-200 px-1 sm:px-3">
          {data.map((item, idx) => {
            const omzetPct = Math.min(
              100,
              Math.max(item.omzet > 0 ? 5 : 2, Math.round((item.omzet / maxVal) * 100))
            );
            const labaPos = Math.max(0, item.labaBersih);
            const labaPct = Math.min(
              100,
              Math.max(
                labaPos > 0 ? 5 : 2,
                Math.round((labaPos / maxVal) * 100)
              )
            );
            const isHovered = hoveredIdx === idx;
            const isToday = idx === data.length - 1;

            return (
              <div
                key={item.dateStr}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-transform ${
                  isHovered ? 'scale-105' : ''
                }`}
              >
                {/* Nilai Ringkas di Atas Batang */}
                <div className="text-[10px] font-bold text-stone-500 mb-1 text-center whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatRupiahSingkat(item.omzet)}
                </div>

                {/* Dua Batang Berdampingan */}
                <div className="w-full max-w-[48px] flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                  {/* Batang Omzet */}
                  <div
                    style={{ height: `${omzetPct}%` }}
                    className={`w-1/2 rounded-t-md transition-all duration-300 ${
                      item.omzet > 0
                        ? isToday
                          ? 'bg-orange-600 group-hover:bg-orange-500'
                          : 'bg-orange-400 group-hover:bg-orange-500'
                        : 'bg-stone-200'
                    }`}
                  />

                  {/* Batang Laba Bersih */}
                  <div
                    style={{ height: `${labaPct}%` }}
                    className={`w-1/2 rounded-t-md transition-all duration-300 ${
                      item.labaBersih > 0
                        ? isToday
                          ? 'bg-emerald-600 group-hover:bg-emerald-500'
                          : 'bg-emerald-400 group-hover:bg-emerald-500'
                        : item.labaBersih < 0
                        ? 'bg-rose-400 group-hover:bg-rose-500'
                        : 'bg-stone-200'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Sumbu X: Label Hari & Tanggal */}
        <div className="flex justify-between gap-1.5 sm:gap-3 px-1 sm:px-3 pt-2">
          {data.map((item, idx) => {
            const isToday = idx === data.length - 1;
            return (
              <div
                key={item.dateStr}
                className="flex-1 text-center flex flex-col items-center"
              >
                <span
                  className={`text-[11px] font-bold ${
                    isToday ? 'text-orange-600' : 'text-stone-700'
                  }`}
                >
                  {isToday ? 'Hari Ini' : item.dayLabel}
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  {item.dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
