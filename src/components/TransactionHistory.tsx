import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileDown,
  MessageCircle,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PaymentStatus, Transaction, WorkshopProfile } from '../types';
import {
  buildWhatsAppMessage,
  exportTransactionsCSV,
  formatDateTimeID,
  formatIDR,
  formatMonthLabel,
  getMonthKey,
  sanitizeWhatsAppPhone,
} from '../utils/format';
import { downloadReceiptPDF } from '../utils/pdfGenerator';
import { ReceiptPreview } from './ReceiptPreview';

interface TransactionHistoryProps {
  transactions: Transaction[];
  profile: WorkshopProfile;
  onEditTransaction: (tx: Transaction) => void;
  onRequestDeleteTransaction: (tx: Transaction) => void;
  onGoToBuilder: () => void;
  onStatusMessage: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  profile,
  onEditTransaction,
  onRequestDeleteTransaction,
  onGoToBuilder,
  onStatusMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    transactions.forEach((tx) => keys.add(getMonthKey(tx.createdAt)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (selectedMonth !== 'all' && getMonthKey(tx.createdAt) !== selectedMonth) {
        return false;
      }
      if (statusFilter !== 'all' && tx.paymentStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const inItems = tx.items.some((i) => i.name.toLowerCase().includes(q));
      return (
        tx.invoiceNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.vehicleInfo.toLowerCase().includes(q) ||
        tx.customerPhone.toLowerCase().includes(q) ||
        inItems
      );
    });
  }, [transactions, searchQuery, selectedMonth, statusFilter]);

  const totalFilteredNominal = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + tx.grandTotal, 0),
    [filteredTransactions]
  );

  const handleSendWhatsApp = async (tx: Transaction) => {
    await downloadReceiptPDF(tx, profile);
    const msg = buildWhatsAppMessage(tx, profile);
    navigator.clipboard.writeText(msg).catch(() => {});
    const phone = sanitizeWhatsAppPhone(tx.customerPhone);
    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onStatusMessage('PDF nota diunduh & teks disalin! Lampirkan PDF ke chat WhatsApp.', 'success');
  };

  return (
    <div className="space-y-5">
      {/* Header & Action Controls */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Riwayat Transaksi</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Catatan tersusun rapi di perangkat lokal ({transactions.length} nota tersimpan).
          </p>
        </div>

        <button
          type="button"
          disabled={filteredTransactions.length === 0}
          onClick={() =>
            exportTransactionsCSV(
              filteredTransactions,
              selectedMonth === 'all' ? 'jaks-gerage-semua' : `jaks-gerage-${selectedMonth}`
            )
          }
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-slate-700" />
          Ekspor CSV ({filteredTransactions.length})
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor nota, pelanggan, plat nomor, atau nama barang/jasa..."
              className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Filter bulan"
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-amber-600 focus:outline-none"
            >
              <option value="all">Semua Bulan</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['all', 'Lunas', 'DP / Sebagian', 'Belum Lunas'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            Menampilkan <strong className="text-slate-900">{filteredTransactions.length}</strong> transaksi
          </span>
          <span>
            Akumulasi nominal:{' '}
            <strong className="font-mono-tabular text-slate-900">
              {formatIDR(totalFilteredNominal)}
            </strong>
          </span>
        </div>
      </div>

      {/* Empty State vs Data Ledger */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <h2 className="text-base font-bold text-slate-900">Belum Ada Riwayat Transaksi</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Semua nota pembayaran yang Anda simpan akan tersusun otomatis di sini, siap dicetak PDF, dikirim ke WhatsApp, atau diekspor ke CSV.
          </p>
          <button
            type="button"
            onClick={onGoToBuilder}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Buat Nota Pertama
          </button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Tidak ada transaksi yang cocok dengan filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedMonth('all');
              setStatusFilter('all');
            }}
            className="mt-3 text-xs font-semibold text-amber-700 hover:underline"
          >
            Reset Filter Pencarian
          </button>
        </div>
      ) : (
        <div className="no-print overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">No. Nota & Tanggal</th>
                  <th className="px-4 py-3">Pelanggan & Kendaraan</th>
                  <th className="px-4 py-3">Ringkasan Item</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status Bayar</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const statusTextClass =
                    tx.paymentStatus === 'Lunas'
                      ? 'text-emerald-700'
                      : tx.paymentStatus === 'DP / Sebagian'
                      ? 'text-amber-700'
                      : 'text-red-600';

                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-mono-tabular text-xs font-bold text-slate-900">
                          {tx.invoiceNumber}
                        </p>
                        <p className="font-mono-tabular mt-0.5 text-xs text-slate-500">
                          {formatDateTimeID(tx.createdAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-900">
                          {tx.customerName || 'Pelanggan Umum'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[tx.vehicleInfo, tx.customerPhone].filter(Boolean).join(' · ') || '-'}
                        </p>
                      </td>

                      <td className="max-w-xs px-4 py-3.5 align-top">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {tx.items.map((i) => i.name).join(', ')}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {tx.items.length} item · {tx.paymentMethod}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top">
                        <p className="font-mono-tabular font-bold text-slate-900">
                          {formatIDR(tx.grandTotal)}
                        </p>
                        {tx.grandTotal - tx.paidAmount > 0 && (
                          <p className="font-mono-tabular mt-0.5 text-[11px] text-red-600">
                            Sisa {formatIDR(tx.grandTotal - tx.paidAmount)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-top text-xs">
                        <p className={`font-semibold ${statusTextClass}`}>{tx.paymentStatus}</p>
                        <p className="font-mono-tabular mt-0.5 text-[11px] text-slate-500">
                          Dibayar {formatIDR(tx.paidAmount)}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            title="Lihat Nota"
                            aria-label="Lihat detail nota"
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadReceiptPDF(tx, profile)}
                            title="Unduh PDF"
                            aria-label="Unduh PDF nota"
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(tx)}
                            title="Kirim WhatsApp"
                            aria-label="Kirim via WhatsApp"
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            title="Edit Nota"
                            aria-label="Edit nota"
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDeleteTransaction(tx)}
                            title="Hapus Nota"
                            aria-label="Hapus nota"
                            className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive List Rows */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredTransactions.map((tx) => {
              const statusTextClass =
                tx.paymentStatus === 'Lunas'
                  ? 'text-emerald-700'
                  : tx.paymentStatus === 'DP / Sebagian'
                  ? 'text-amber-700'
                  : 'text-red-600';

              return (
                <div key={tx.id} className="p-4">
                  <button
                    type="button"
                    onClick={() => setSelectedTx(tx)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono-tabular text-xs font-bold text-slate-900">
                          {tx.invoiceNumber}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                          {tx.customerName || 'Pelanggan Umum'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-tabular text-sm font-bold text-slate-900">
                          {formatIDR(tx.grandTotal)}
                        </p>
                        <p className={`text-xs font-semibold ${statusTextClass}`}>
                          {tx.paymentStatus}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {formatDateTimeID(tx.createdAt)} · {tx.items.length} item · {tx.paymentMethod}
                    </p>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => downloadReceiptPDF(tx, profile)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <FileDown className="h-3.5 w-3.5 text-amber-600" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(tx)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTransaction(tx)}
                      className="ml-auto inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label="Hapus nota"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Receipt Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-[#F7F8FA] p-4 sm:p-6 shadow-xl">
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Detail Nota {selectedTx.invoiceNumber}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadReceiptPDF(selectedTx, profile)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <FileDown className="h-3.5 w-3.5 text-amber-600" />
                  Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(selectedTx)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  aria-label="Tutup pratinjau"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ReceiptPreview
              transaction={selectedTx}
              profile={profile}
              printableId="printable-receipt-area"
            />
          </div>
        </div>
      )}
    </div>
  );
};
