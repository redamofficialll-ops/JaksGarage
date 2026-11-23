import * as XLSX from 'xlsx';
import { WorkshopProfile } from '../types';
import { formatDateTimeID, formatMonthLabel } from './format';
import { MonthlyDashboardExportData } from './pdfGenerator';

export function exportMonthlyDashboardExcel(
  data: MonthlyDashboardExportData,
  profile: WorkshopProfile
): void {
  const workbook = XLSX.utils.book_new();
  const monthLabel = formatMonthLabel(data.monthKey);

  // Sheet 1: Ringkasan Bulanan
  const summaryRows: (string | number)[][] = [
    ['LAPORAN PENJUALAN BULANAN', profile.name],
    ['Periode Bulan', monthLabel],
    ['Alamat Bengkel', profile.address],
    ['Tanggal Ekspor', formatDateTimeID(new Date().toISOString())],
    [],
    ['INDIKATOR KINERJA BULANAN', 'NILAI'],
    ['Total Omzet Penjualan (Rp)', data.metrics.totalRevenue],
    ['Total Kas Masuk / Dibayar (Rp)', data.metrics.totalPaid],
    ['Total Piutang / Sisa Tagihan (Rp)', data.metrics.outstanding],
    ['Jumlah Nota Transaksi', data.metrics.txCount],
    ['Rata-Rata Nilai Nota (Rp)', data.metrics.avgTicket],
    ['Pendapatan Jasa (Rp)', data.metrics.jasaRevenue],
    ['Pendapatan Barang (Rp)', data.metrics.barangRevenue],
    ['Nota Lunas', data.metrics.lunasCount],
    ['Nota DP / Sebagian', data.metrics.dpCount],
    ['Nota Belum Lunas', data.metrics.unpaidCount],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan Bulanan');

  // Sheet 2: Penjualan Harian
  const dailyRows: (string | number)[][] = [
    ['Tanggal', 'Jumlah Nota', 'Omzet Harian (Rp)'],
    ...data.dailySeries.map((d) => [
      `${String(d.day).padStart(2, '0')} ${monthLabel}`,
      d.count,
      d.revenue,
    ]),
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = [{ wch: 24 }, { wch: 15 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, wsDaily, 'Penjualan Harian');

  // Sheet 3: Item Terlaris
  const topRows: (string | number)[][] = [
    ['Nama Barang / Jasa', 'Kategori', 'Qty Terjual', 'Total Penjualan (Rp)'],
    ...data.metrics.topItems.map((item) => [
      item.name,
      item.category,
      item.qty,
      item.total,
    ]),
  ];
  const wsTop = XLSX.utils.aoa_to_sheet(topRows);
  wsTop['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, wsTop, 'Item Terlaris');

  // Sheet 4: Rincian Transaksi
  const txRows: (string | number)[][] = [
    [
      'No. Nota',
      'Tanggal Transaksi',
      'Pelanggan',
      'No. WhatsApp',
      'Kendaraan / Plat',
      'Rincian Barang & Jasa',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'Pajak (Rp)',
      'Total Akhir (Rp)',
      'Dibayar (Rp)',
      'Sisa Tagihan (Rp)',
      'Status Bayar',
      'Metode Bayar',
      'Catatan',
    ],
    ...data.transactions.map((tx) => {
      const itemsText = tx.items
        .map((i) => `[${i.category}] ${i.name} (${i.qty} ${i.unit || 'pcs'} x ${i.unitPrice})`)
        .join(' | ');
      return [
        tx.invoiceNumber,
        formatDateTimeID(tx.createdAt),
        tx.customerName || 'Pelanggan Umum',
        tx.customerPhone || '',
        tx.vehicleInfo || '',
        itemsText,
        tx.subtotal,
        tx.discountAmount,
        tx.taxAmount,
        tx.grandTotal,
        tx.paidAmount,
        Math.max(0, tx.grandTotal - tx.paidAmount),
        tx.paymentStatus,
        tx.paymentMethod,
        tx.notes || '',
      ];
    }),
  ];
  const wsTx = XLSX.utils.aoa_to_sheet(txRows);
  wsTx['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 46 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsTx, 'Rincian Transaksi');

  XLSX.writeFile(workbook, `JaksGerage-Dashboard-${data.monthKey}.xlsx`);
}
