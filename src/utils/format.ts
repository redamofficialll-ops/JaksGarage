import { LineItem, Transaction, WorkshopProfile } from '../types';

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatNumberID(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID').format(safe);
}

export function formatDateID(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeID(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getMonthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1;
  const d = new Date(year, month, 1);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export function calculateTotals(
  items: LineItem[],
  discountType: 'nominal' | 'percent',
  discountValue: number,
  taxPercent: number
) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return sum + qty * price;
  }, 0);

  const rawDiscount =
    discountType === 'percent'
      ? (subtotal * Math.min(100, Math.max(0, Number(discountValue) || 0))) / 100
      : Math.max(0, Number(discountValue) || 0);
  const discountAmount = Math.min(subtotal, Math.round(rawDiscount));
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxRate = Math.min(100, Math.max(0, Number(taxPercent) || 0));
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const grandTotal = afterDiscount + taxAmount;

  return {
    subtotal: Math.round(subtotal),
    discountAmount,
    taxAmount,
    grandTotal: Math.round(grandTotal),
  };
}

export function generateInvoiceNumber(existing: Transaction[]): string {
  const now = new Date();
  const prefix = `JG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  let maxSeq = 0;
  for (const tx of existing) {
    if (tx.invoiceNumber.startsWith(prefix + '-')) {
      const tail = tx.invoiceNumber.slice(prefix.length + 1);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return `${prefix}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export function sanitizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildWhatsAppMessage(tx: Transaction, profile: WorkshopProfile): string {
  const lines: string[] = [
    `*${profile.name.toUpperCase()}*`,
    profile.tagline ? `_${profile.tagline}_` : '',
    profile.address ? `${profile.address}` : '',
    `--------------------------------`,
    `No. Nota : *${tx.invoiceNumber}*`,
    `Tanggal  : ${formatDateTimeID(tx.createdAt)}`,
    `Pelanggan: ${tx.customerName || 'Pelanggan Umum'}`,
    tx.vehicleInfo ? `Kendaraan: ${tx.vehicleInfo}` : '',
    `--------------------------------`,
    `*Rincian Barang & Jasa:*`,
  ].filter(Boolean);

  tx.items.forEach((item, idx) => {
    const lineTotal = item.qty * item.unitPrice;
    lines.push(
      `${idx + 1}. [${item.category}] ${item.name}`,
      `   ${item.qty} ${item.unit || 'pcs'} x ${formatIDR(item.unitPrice)} = *${formatIDR(lineTotal)}*`
    );
  });

  lines.push(`--------------------------------`);
  lines.push(`Subtotal : ${formatIDR(tx.subtotal)}`);
  if (tx.discountAmount > 0) {
    lines.push(`Diskon   : -${formatIDR(tx.discountAmount)}`);
  }
  if (tx.taxAmount > 0) {
    lines.push(`Pajak (${tx.taxPercent}%): ${formatIDR(tx.taxAmount)}`);
  }
  lines.push(`*TOTAL   : ${formatIDR(tx.grandTotal)}*`);
  lines.push(`Dibayar  : ${formatIDR(tx.paidAmount)} (${tx.paymentMethod})`);
  const sisa = Math.max(0, tx.grandTotal - tx.paidAmount);
  if (sisa > 0) {
    lines.push(`Sisa Tagihan: *${formatIDR(sisa)}*`);
  }
  lines.push(`Status   : *${tx.paymentStatus.toUpperCase()}*`);
  if (tx.notes) {
    lines.push(`Catatan  : ${tx.notes}`);
  }
  lines.push(`--------------------------------`);
  if (profile.footerNote) {
    lines.push(profile.footerNote);
  }
  return lines.join('\n');
}

function escapeCSVField(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsCSV(transactions: Transaction[], filenamePrefix = 'jaks-gerage-transaksi'): void {
  const headers = [
    'No. Nota',
    'Tanggal Transaksi',
    'Nama Pelanggan',
    'No. WhatsApp',
    'Kendaraan / Plat',
    'Rincian Barang & Jasa',
    'Total Barang (Rp)',
    'Total Jasa (Rp)',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    'Nominal Dibayar (Rp)',
    'Status Pembayaran',
    'Metode Pembayaran',
    'Catatan',
  ];

  const rows = transactions.map((tx) => {
    const barangTotal = tx.items
      .filter((i) => i.category === 'Barang')
      .reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
    const jasaTotal = tx.items
      .filter((i) => i.category === 'Jasa')
      .reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
    const summaryItems = tx.items
      .map((i) => `[${i.category}] ${i.name} (${i.qty} ${i.unit || 'pcs'} x ${i.unitPrice})`)
      .join(' | ');

    return [
      tx.invoiceNumber,
      formatDateTimeID(tx.createdAt),
      tx.customerName || 'Pelanggan Umum',
      tx.customerPhone || '',
      tx.vehicleInfo || '',
      summaryItems,
      barangTotal,
      jasaTotal,
      tx.subtotal,
      tx.discountAmount,
      tx.taxAmount,
      tx.grandTotal,
      tx.paidAmount,
      tx.paymentStatus,
      tx.paymentMethod,
      tx.notes || '',
    ].map(escapeCSVField);
  });

  const csvContent =
    '\uFEFF' + [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filenamePrefix}-${dateStamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
