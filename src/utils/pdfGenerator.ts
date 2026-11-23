import { jsPDF } from 'jspdf';
import { Transaction, WorkshopProfile } from '../types';
import { formatDateID, formatDateTimeID, formatIDR, formatMonthLabel } from './format';

export interface MonthlyDashboardExportData {
  monthKey: string;
  transactions: Transaction[];
  metrics: {
    totalRevenue: number;
    totalPaid: number;
    outstanding: number;
    txCount: number;
    avgTicket: number;
    barangRevenue: number;
    jasaRevenue: number;
    lunasCount: number;
    dpCount: number;
    unpaidCount: number;
    topItems: { name: string; category: string; qty: number; total: number }[];
  };
  dailySeries: { day: number; revenue: number; count: number }[];
}

interface LoadedLogo {
  dataUrl: string;
  aspectRatio: number;
}

let cachedLogo: LoadedLogo | null = null;
let pendingLogoPromise: Promise<LoadedLogo | null> | null = null;

export function loadWorkshopLogoForPDF(): Promise<LoadedLogo | null> {
  if (cachedLogo) return Promise.resolve(cachedLogo);
  if (pendingLogoPromise) return pendingLogoPromise;
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }

  pendingLogoPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 2908;
        const naturalH = img.naturalHeight || 1440;
        const targetW = Math.min(naturalW, 720);
        const targetH = Math.max(1, Math.round((targetW / naturalW) * naturalH));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        cachedLogo = { dataUrl, aspectRatio: naturalW / naturalH };
        resolve(cachedLogo);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/workshop-logo.png';
  });

  return pendingLogoPromise;
}

function drawPDFHeaderBanner(
  doc: jsPDF,
  margin: number,
  y: number,
  contentWidth: number,
  pageWidth: number,
  profile: WorkshopProfile,
  rightEyebrow: string,
  rightTitle: string,
  logo: LoadedLogo | null,
  rightTitleIsMono = false
) {
  const bannerHeight = 25;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, bannerHeight, 'F');

  let textStartX = margin + 6;
  if (logo) {
    const imgHeight = 13.5;
    const imgWidth = Math.min(34, imgHeight * logo.aspectRatio);
    const pad = 1.2;
    const boxX = margin + 5;
    const boxY = y + (bannerHeight - (imgHeight + pad * 2)) / 2;

    doc.setFillColor(5, 8, 16);
    doc.roundedRect(boxX, boxY, imgWidth + pad * 2, imgHeight + pad * 2, 1.5, 1.5, 'F');
    doc.addImage(logo.dataUrl, 'JPEG', boxX + pad, boxY + pad, imgWidth, imgHeight);
    textStartX = boxX + imgWidth + pad * 2 + 4.5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16.5);
  doc.text(profile.name, textStartX, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(203, 213, 225);
  const taglineMaxWidth = contentWidth - (textStartX - margin) - 52;
  const taglineClipped =
    doc.splitTextToSize(profile.tagline || 'Nota Pembayaran Resmi', taglineMaxWidth)[0] || '';
  doc.text(taglineClipped, textStartX, y + 16.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text(rightEyebrow, pageWidth - margin - 6, y + 10.5, { align: 'right' });

  doc.setFont(rightTitleIsMono ? 'courier' : 'helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(rightTitle, pageWidth - margin - 6, y + 16.8, { align: 'right' });
}

export async function buildReceiptPDF(
  tx: Transaction,
  profile: WorkshopProfile
): Promise<jsPDF> {
  const logo = await loadWorkshopLogoForPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  drawPDFHeaderBanner(
    doc,
    margin,
    y,
    contentWidth,
    pageWidth,
    profile,
    'NOTA PEMBAYARAN',
    tx.invoiceNumber,
    logo,
    true
  );

  y += 31;

  // Workshop info + Invoice info columns
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const addressLines: string[] = profile.address
    ? doc.splitTextToSize(profile.address, contentWidth - 68)
    : [];
  if (addressLines.length > 0) {
    doc.text(addressLines, margin, y);
  }
  const phoneY = y + Math.max(1, addressLines.length) * 4.2;
  if (profile.phone) {
    doc.text(`Telp / WA: ${profile.phone}`, margin, phoneY);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal: ${formatDateID(tx.createdAt)}`, pageWidth - margin, y, { align: 'right' });
  doc.text(`Metode: ${tx.paymentMethod}`, pageWidth - margin, y + 4.5, { align: 'right' });

  const leftBottomY = profile.phone ? phoneY + 4.5 : phoneY + 1;
  const rightBottomY = y + 10;
  y = Math.max(leftBottomY, rightBottomY) + 1.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Customer Details Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 18, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 18, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('KEPADA PELANGGAN', margin + 4, y + 5.5);
  doc.text('KENDARAAN / REFERENSI', margin + contentWidth * 0.52, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.customerName || 'Pelanggan Umum', margin + 4, y + 11);
  doc.text(tx.vehicleInfo || '-', margin + contentWidth * 0.52, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(tx.customerPhone ? `WA: ${tx.customerPhone}` : 'No. WA: -', margin + 4, y + 15.5);

  y += 24;

  // Items Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('NO', margin + 3, y + 5.4);
  doc.text('DESKRIPSI BARANG / JASA', margin + 12, y + 5.4);
  doc.text('TIPE', margin + 102, y + 5.4);
  doc.text('QTY', margin + 125, y + 5.4, { align: 'right' });
  doc.text('HARGA', margin + 151, y + 5.4, { align: 'right' });
  doc.text('SUBTOTAL', pageWidth - margin - 3, y + 5.4, { align: 'right' });
  y += 8;

  // Table Rows
  doc.setFontSize(8.5);
  tx.items.forEach((item, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const rowHeight = 8;
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(index + 1), margin + 3, y + 5.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const nameClipped = doc.splitTextToSize(item.name, 84)[0] || item.name;
    doc.text(nameClipped, margin + 12, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(item.category, margin + 102, y + 5.5);

    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.qty} ${item.unit || 'pcs'}`, margin + 125, y + 5.5, { align: 'right' });
    doc.text(formatIDR(item.unitPrice), margin + 151, y + 5.5, { align: 'right' });
    doc.setFont('courier', 'bold');
    doc.text(formatIDR(item.qty * item.unitPrice), pageWidth - margin - 3, y + 5.5, {
      align: 'right',
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  });

  y += 6;

  // Summary Totals & Status Stamp
  const summaryStartX = pageWidth - margin - 78;
  const labelX = summaryStartX;
  const valueX = pageWidth - margin - 3;

  doc.setDrawColor(
    tx.paymentStatus === 'Lunas' ? 22 : tx.paymentStatus === 'DP / Sebagian' ? 217 : 220,
    tx.paymentStatus === 'Lunas' ? 163 : tx.paymentStatus === 'DP / Sebagian' ? 119 : 38,
    tx.paymentStatus === 'Lunas' ? 74 : tx.paymentStatus === 'DP / Sebagian' ? 6 : 38
  );
  doc.setLineWidth(0.8);
  doc.rect(margin, y, 48, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(
    tx.paymentStatus === 'Lunas' ? 22 : tx.paymentStatus === 'DP / Sebagian' ? 180 : 220,
    tx.paymentStatus === 'Lunas' ? 163 : tx.paymentStatus === 'DP / Sebagian' ? 83 : 38,
    tx.paymentStatus === 'Lunas' ? 74 : tx.paymentStatus === 'DP / Sebagian' ? 9 : 38
  );
  doc.text(tx.paymentStatus.toUpperCase(), margin + 24, y + 7.5, { align: 'center' });

  if (tx.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CATATAN:', margin, y + 19);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const wrappedNotes = doc.splitTextToSize(tx.notes, 85);
    doc.text(wrappedNotes, margin, y + 23.5);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', labelX, y + 5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatIDR(tx.subtotal), valueX, y + 5, { align: 'right' });

  let sumY = y + 10.5;
  if (tx.discountAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Diskon', labelX, sumY);
    doc.setFont('courier', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatIDR(tx.discountAmount)}`, valueX, sumY, { align: 'right' });
    sumY += 5.5;
  }

  if (tx.taxAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Pajak (${tx.taxPercent}%)`, labelX, sumY);
    doc.setFont('courier', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatIDR(tx.taxAmount), valueX, sumY, { align: 'right' });
    sumY += 5.5;
  }

  doc.setFillColor(15, 23, 42);
  doc.rect(labelX - 3, sumY, 81, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AKHIR', labelX, sumY + 6.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(245, 158, 11);
  doc.text(formatIDR(tx.grandTotal), valueX, sumY + 6.5, { align: 'right' });

  sumY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Nominal Dibayar', labelX, sumY);
  doc.setFont('courier', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatIDR(tx.paidAmount), valueX, sumY, { align: 'right' });

  const remaining = Math.max(0, tx.grandTotal - tx.paidAmount);
  if (remaining > 0) {
    sumY += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text('Sisa Tagihan', labelX, sumY);
    doc.setFont('courier', 'bold');
    doc.text(formatIDR(remaining), valueX, sumY, { align: 'right' });
  }

  const footerY = 276;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(profile.footerNote || 'Terima kasih atas kunjungan Anda.', pageWidth / 2, footerY, {
    align: 'center',
  });

  return doc;
}

export async function downloadReceiptPDF(
  tx: Transaction,
  profile: WorkshopProfile
): Promise<void> {
  const doc = await buildReceiptPDF(tx, profile);
  doc.save(`${tx.invoiceNumber}-JaksGarage.pdf`);
}

export async function exportMonthlyDashboardPDF(
  data: MonthlyDashboardExportData,
  profile: WorkshopProfile
): Promise<void> {
  const logo = await loadWorkshopLogoForPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const monthLabel = formatMonthLabel(data.monthKey);
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  drawPDFHeaderBanner(
    doc,
    margin,
    y,
    contentWidth,
    pageWidth,
    profile,
    'LAPORAN DASHBOARD BULANAN',
    monthLabel.toUpperCase(),
    logo,
    false
  );

  y += 31;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dicetak pada: ${formatDateTimeID(new Date().toISOString())}`, margin, y);
  y += 6;

  // 4-Box KPI Grid
  const boxGap = 3;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  const kpis = [
    { label: 'TOTAL OMZET', value: formatIDR(data.metrics.totalRevenue), sub: `Kas: ${formatIDR(data.metrics.totalPaid)}` },
    { label: 'JUMLAH TRANSAKSI', value: `${data.metrics.txCount} Nota`, sub: `${data.metrics.lunasCount} Lunas / ${data.metrics.dpCount} DP` },
    { label: 'RATA-RATA NOTA', value: formatIDR(data.metrics.avgTicket), sub: `Piutang: ${formatIDR(data.metrics.outstanding)}` },
    { label: 'JASA VS BARANG', value: formatIDR(data.metrics.jasaRevenue), sub: `Barang: ${formatIDR(data.metrics.barangRevenue)}` },
  ];

  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxWidth + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(bx, y, boxWidth, 21, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, bx + 3, y + 5.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, bx + 3, y + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, bx + 3, y + 18);
  });

  y += 28;

  // Daily Bar Chart Visual inside PDF
  const activeDays = data.dailySeries.filter((d) => d.revenue > 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Grafik Omzet Harian', margin, y);
  y += 4;

  const chartHeight = 32;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, chartHeight + 8, 'FD');

  const maxDaily = Math.max(...data.dailySeries.map((d) => d.revenue), 1);
  const slotW = (contentWidth - 8) / data.dailySeries.length;
  const barW = Math.max(2.2, slotW * 0.65);

  data.dailySeries.forEach((bucket, idx) => {
    const bx = margin + 4 + idx * slotW + (slotW - barW) / 2;
    const bh = bucket.revenue > 0 ? Math.max(2, (bucket.revenue / maxDaily) * (chartHeight - 4)) : 0.8;
    const by = y + chartHeight - bh + 1;

    if (bucket.revenue > 0) {
      doc.setFillColor(217, 119, 6);
    } else {
      doc.setFillColor(226, 232, 240);
    }
    doc.rect(bx, by, barW, bh, 'F');

    if (bucket.day === 1 || bucket.day % 5 === 0 || bucket.day === data.dailySeries.length) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(bucket.day), bx + barW / 2, y + chartHeight + 5.5, { align: 'center' });
    }
  });

  y += chartHeight + 16;

  // Top Items Table
  if (data.metrics.topItems.length > 0) {
    ensureSpace(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Barang & Jasa Terlaris', margin, y);
    y += 4;

    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('NAMA BARANG / JASA', margin + 3, y + 5);
    doc.text('KATEGORI', margin + 96, y + 5);
    doc.text('QTY', margin + 128, y + 5, { align: 'right' });
    doc.text('TOTAL PENJUALAN', pageWidth - margin - 3, y + 5, { align: 'right' });
    y += 7.5;

    data.metrics.topItems.forEach((item, idx) => {
      ensureSpace(8);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 7, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const clipped = doc.splitTextToSize(item.name, 88)[0] || item.name;
      doc.text(clipped, margin + 3, y + 4.8);
      doc.setTextColor(71, 85, 105);
      doc.text(item.category, margin + 96, y + 4.8);
      doc.setFont('courier', 'normal');
      doc.text(String(item.qty), margin + 128, y + 4.8, { align: 'right' });
      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatIDR(item.total), pageWidth - margin - 3, y + 4.8, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      y += 7;
    });

    y += 8;
  }

  // Transaction Ledger
  if (activeDays.length > 0) {
    ensureSpace(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rincian Transaksi (${data.transactions.length} Nota)`, margin, y);
    y += 4;

    const drawTxHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('NO. NOTA', margin + 3, y + 5);
      doc.text('TANGGAL', margin + 36, y + 5);
      doc.text('PELANGGAN', margin + 70, y + 5);
      doc.text('STATUS', margin + 120, y + 5);
      doc.text('TOTAL', pageWidth - margin - 3, y + 5, { align: 'right' });
      y += 7.5;
    };

    drawTxHeader();

    data.transactions.forEach((tx, idx) => {
      if (y + 8 > pageHeight - 16) {
        doc.addPage();
        y = 18;
        drawTxHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 7, 'F');
      }
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tx.invoiceNumber, margin + 3, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(formatDateID(tx.createdAt), margin + 36, y + 4.8);

      doc.setTextColor(15, 23, 42);
      const cust = doc.splitTextToSize(tx.customerName || 'Pelanggan Umum', 46)[0] || 'Pelanggan Umum';
      doc.text(cust, margin + 70, y + 4.8);

      doc.setTextColor(71, 85, 105);
      doc.text(`${tx.paymentStatus} (${tx.paymentMethod})`, margin + 120, y + 4.8);

      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatIDR(tx.grandTotal), pageWidth - margin - 3, y + 4.8, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      y += 7;
    });
  }

  doc.save(`JaksGarage-Dashboard-${data.monthKey}.pdf`);
}
