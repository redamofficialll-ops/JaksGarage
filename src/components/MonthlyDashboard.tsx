import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet } from 'lucide-react';
import { Transaction, WorkshopProfile } from '../types';
import { exportMonthlyDashboardExcel } from '../utils/excelExport';
import {
  formatIDR,
  formatMonthLabel,
  getMonthKey,
} from '../utils/format';
import { exportMonthlyDashboardPDF } from '../utils/pdfGenerator';

interface MonthlyDashboardProps {
  transactions: Transaction[];
  profile: WorkshopProfile;
  onGoToBuilder: () => void;
  onStatusMessage: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const MonthlyDashboard: React.FC<MonthlyDashboardProps> = ({
  transactions,
  profile,
  onGoToBuilder,
  onStatusMessage,
}) => {
  const currentMonthKey = getMonthKey(new Date().toISOString());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set<string>([currentMonthKey]);
    transactions.forEach((tx) => set.add(getMonthKey(tx.createdAt)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentMonthKey]);

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => getMonthKey(tx.createdAt) === selectedMonth),
    [transactions, selectedMonth]
  );

  const metrics = useMemo(() => {
    const totalRevenue = monthTransactions.reduce((sum, tx) => sum + tx.grandTotal, 0);
    const totalPaid = monthTransactions.reduce((sum, tx) => sum + tx.paidAmount, 0);
    const txCount = monthTransactions.length;
    const avgTicket = txCount > 0 ? Math.round(totalRevenue / txCount) : 0;

    let barangRevenue = 0;
    let jasaRevenue = 0;
    const itemStats = new Map<string, { name: string; category: string; qty: number; total: number }>();

    monthTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const lineTotal = item.qty * item.unitPrice;
        if (item.category === 'Barang') {
          barangRevenue += lineTotal;
        } else {
          jasaRevenue += lineTotal;
        }
        const key = `${item.category}:${item.name.toLowerCase()}`;
        const existing = itemStats.get(key);
        if (existing) {
          existing.qty += item.qty;
          existing.total += lineTotal;
        } else {
          itemStats.set(key, {
            name: item.name,
            category: item.category,
            qty: item.qty,
            total: lineTotal,
          });
        }
      });
    });

    const lunasCount = monthTransactions.filter((t) => t.paymentStatus === 'Lunas').length;
    const dpCount = monthTransactions.filter((t) => t.paymentStatus === 'DP / Sebagian').length;
    const unpaidCount = monthTransactions.filter((t) => t.paymentStatus === 'Belum Lunas').length;

    const topItems = Array.from(itemStats.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      totalRevenue,
      totalPaid,
      outstanding: Math.max(0, totalRevenue - totalPaid),
      txCount,
      avgTicket,
      barangRevenue,
      jasaRevenue,
      lunasCount,
      dpCount,
      unpaidCount,
      topItems,
    };
  }, [monthTransactions]);

  const dailySeries = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const daysInMonth = new Date(year, month, 0).getDate();

    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      revenue: 0,
      count: 0,
    }));

    monthTransactions.forEach((tx) => {
      const d = new Date(tx.createdAt);
      const dayIdx = d.getDate() - 1;
      if (dayIdx >= 0 && dayIdx < daysInMonth) {
        buckets[dayIdx].revenue += tx.grandTotal;
        buckets[dayIdx].count += 1;
      }
    });

    const maxRevenue = Math.max(...buckets.map((b) => b.revenue), 1);
    return { buckets, maxRevenue };
  }, [monthTransactions, selectedMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setHoveredDay(null);
  };

  const handleExportPDF = async () => {
    await exportMonthlyDashboardPDF(
      {
        monthKey: selectedMonth,
        transactions: monthTransactions,
        metrics,
        dailySeries: dailySeries.buckets,
      },
      profile
    );
    onStatusMessage(`Laporan PDF ${formatMonthLabel(selectedMonth)} berhasil diunduh.`, 'success');
  };

  const handleExportExcel = () => {
    exportMonthlyDashboardExcel(
      {
        monthKey: selectedMonth,
        transactions: monthTransactions,
        metrics,
        dailySeries: dailySeries.buckets,
      },
      profile
    );
    onStatusMessage(`Laporan Excel (.xlsx) ${formatMonthLabel(selectedMonth)} berhasil diunduh.`, 'success');
  };

  const categoryTotal = metrics.barangRevenue + metrics.jasaRevenue;
  const jasaShare = categoryTotal > 0 ? Math.round((metrics.jasaRevenue / categoryTotal) * 100) : 0;
  const barangShare = categoryTotal > 0 ? 100 - jasaShare : 0;

  const activeDayData = hoveredDay
    ? dailySeries.buckets.find((b) => b.day === hoveredDay) || null
    : null;

  return (
    <div className="space-y-6">
      {/* Header & Month Navigation + PDF / Excel Exports */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Penjualan Bulanan
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Pantau omzet, perbandingan jasa vs barang, dan ekspor laporan bulanan ke PDF atau Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setHoveredDay(null);
              }}
              aria-label="Pilih bulan laporan"
              className="min-h-[38px] bg-transparent px-2 text-xs font-bold text-slate-900 focus:outline-none"
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={monthTransactions.length === 0}
            onClick={handleExportPDF}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileDown className="h-4 w-4 text-amber-600" />
            Ekspor PDF
          </button>

          <button
            type="button"
            disabled={monthTransactions.length === 0}
            onClick={handleExportExcel}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Ekspor Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Omzet ({formatMonthLabel(selectedMonth)})</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
            {formatIDR(metrics.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kas masuk:{' '}
            <span className="font-mono-tabular font-semibold text-emerald-700">
              {formatIDR(metrics.totalPaid)}
            </span>
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Jumlah Transaksi</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
            {metrics.txCount} Nota
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {metrics.lunasCount} Lunas · {metrics.dpCount} DP · {metrics.unpaidCount} Belum Lunas
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Rata-Rata Nilai Nota</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
            {formatIDR(metrics.avgTicket)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Piutang berjalan:{' '}
            <span className="font-mono-tabular font-semibold text-red-600">
              {formatIDR(metrics.outstanding)}
            </span>
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Komposisi Jasa vs Barang</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
            {jasaShare}% / {barangShare}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Jasa {formatIDR(metrics.jasaRevenue)} · Barang {formatIDR(metrics.barangRevenue)}
          </p>
        </div>
      </div>

      {monthTransactions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <h2 className="text-base font-bold text-slate-900">
            Belum Ada Penjualan di {formatMonthLabel(selectedMonth)}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Buat nota pembayaran baru atau pilih bulan lain untuk melihat grafik penjualan serta mengekspor laporan PDF atau Excel.
          </p>
          <button
            type="button"
            onClick={onGoToBuilder}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Input Transaksi Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Daily Revenue Bar Chart */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Grafik Penjualan Harian ({formatMonthLabel(selectedMonth)})
                </h2>
                <p className="text-xs text-slate-500">
                  Arahkan kursor atau ketuk batang tanggal untuk melihat detail omzet harian.
                </p>
              </div>
              {activeDayData && (
                <div className="text-right text-xs">
                  <span className="font-semibold text-slate-700">Tanggal {activeDayData.day}: </span>
                  <span className="font-mono-tabular font-bold text-amber-700">
                    {formatIDR(activeDayData.revenue)}
                  </span>
                  <span className="text-slate-500"> ({activeDayData.count} nota)</span>
                </div>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[540px]">
                <svg
                  viewBox="0 0 680 220"
                  className="h-56 w-full"
                  role="img"
                  aria-label="Grafik batang pendapatan harian"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 185 - ratio * 155;
                    return (
                      <g key={idx}>
                        <line
                          x1="4"
                          y1={y}
                          x2="676"
                          y2={y}
                          stroke="#E2E8F0"
                          strokeWidth="1"
                          strokeDasharray={ratio === 0 ? undefined : '3 3'}
                        />
                      </g>
                    );
                  })}

                  {dailySeries.buckets.map((bucket, idx) => {
                    const slotWidth = 670 / dailySeries.buckets.length;
                    const barWidth = Math.max(8, slotWidth * 0.64);
                    const x = 6 + idx * slotWidth + (slotWidth - barWidth) / 2;
                    const height =
                      bucket.revenue > 0
                        ? Math.max(4, (bucket.revenue / dailySeries.maxRevenue) * 155)
                        : 2;
                    const y = 185 - height;
                    const isHovered = hoveredDay === bucket.day;

                    return (
                      <g
                        key={bucket.day}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredDay(bucket.day)}
                        onClick={() => setHoveredDay(bucket.day)}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={height}
                          rx={3}
                          fill={
                            bucket.revenue === 0
                              ? '#E2E8F0'
                              : isHovered
                              ? '#B45309'
                              : '#D97706'
                          }
                        />
                        {(bucket.day === 1 || bucket.day % 5 === 0 || bucket.day === dailySeries.buckets.length) && (
                          <text
                            x={x + barWidth / 2}
                            y={206}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748B"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {bucket.day}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </section>

          {/* Top Items & Category Split */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              Barang & Jasa Terlaris
            </h2>

            <div className="mt-4">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <span>Jasa ({jasaShare}%)</span>
                <span>Barang ({barangShare}%)</span>
              </div>
              <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-slate-900 transition-all"
                  style={{ width: `${jasaShare}%` }}
                />
                <div
                  className="bg-amber-600 transition-all"
                  style={{ width: `${barangShare}%` }}
                />
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {metrics.topItems.map((item, idx) => (
                <div key={`${item.category}-${item.name}-${idx}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.category} · {item.qty} terjual
                    </p>
                  </div>
                  <p className="font-mono-tabular shrink-0 text-xs font-bold text-slate-900">
                    {formatIDR(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
