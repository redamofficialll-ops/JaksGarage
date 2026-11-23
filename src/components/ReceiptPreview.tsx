import React from 'react';
import { Transaction, WorkshopProfile } from '../types';
import { formatDateID, formatIDR } from '../utils/format';

interface ReceiptPreviewProps {
  transaction: Transaction;
  profile: WorkshopProfile;
  printableId?: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  transaction,
  profile,
  printableId,
}) => {
  const remaining = Math.max(0, transaction.grandTotal - transaction.paidAmount);
  const statusColor =
    transaction.paymentStatus === 'Lunas'
      ? 'border-emerald-700 text-emerald-700 bg-emerald-50/40'
      : transaction.paymentStatus === 'DP / Sebagian'
      ? 'border-amber-700 text-amber-800 bg-amber-50/40'
      : 'border-red-700 text-red-700 bg-red-50/40';

  return (
    <div
      id={printableId}
      className="rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs overflow-hidden"
    >
      {/* Receipt Header */}
      <div className="bg-slate-900 px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/workshop-logo.png"
              alt="Jaks Garage Logo"
              className="h-10 w-auto max-w-[160px] object-contain rounded bg-black/40 p-1"
            />
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-white">
                {profile.name}
              </h2>
              {profile.tagline && (
                <p className="mt-0.5 text-xs text-slate-300">{profile.tagline}</p>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-semibold tracking-wider text-amber-400">
              NOTA PEMBAYARAN
            </p>
            <p className="font-mono-tabular mt-0.5 text-sm font-semibold text-white">
              {transaction.invoiceNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Workshop & Transaction Metadata */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-relaxed text-slate-800">{profile.address}</p>
            {profile.phone && <p className="mt-0.5">Telp / WA: {profile.phone}</p>}
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="font-mono-tabular text-slate-800">
              {formatDateID(transaction.createdAt)}
            </p>
            <p className="mt-0.5">Metode: {transaction.paymentMethod}</p>
          </div>
        </div>
      </div>

      {/* Customer & Vehicle Details */}
      <div className="grid grid-cols-1 gap-3 border-b border-slate-200 px-5 py-3.5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Pelanggan</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {transaction.customerName || 'Pelanggan Umum'}
          </p>
          {transaction.customerPhone && (
            <p className="font-mono-tabular text-xs text-slate-600">{transaction.customerPhone}</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">Kendaraan / Referensi</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {transaction.vehicleInfo || '-'}
          </p>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="px-5 py-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500">
                <th className="pb-2 pr-2 font-semibold">Item / Pekerjaan</th>
                <th className="pb-2 px-2 text-right font-semibold">Qty</th>
                <th className="pb-2 px-2 text-right font-semibold">Harga</th>
                <th className="pb-2 pl-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transaction.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    Belum ada barang atau jasa yang ditambahkan.
                  </td>
                </tr>
              ) : (
                transaction.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-2 align-top">
                      <p className="font-medium text-slate-900">
                        {item.name || 'Item tanpa nama'}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.category}</p>
                    </td>
                    <td className="font-mono-tabular whitespace-nowrap py-2.5 px-2 text-right align-top text-slate-700">
                      {item.qty} {item.unit || 'pcs'}
                    </td>
                    <td className="font-mono-tabular whitespace-nowrap py-2.5 px-2 text-right align-top text-slate-700">
                      {formatIDR(item.unitPrice)}
                    </td>
                    <td className="font-mono-tabular whitespace-nowrap py-2.5 pl-2 text-right align-top font-semibold text-slate-900">
                      {formatIDR(item.qty * item.unitPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Payment Status Stamp */}
        <div className="mt-4 flex flex-col justify-between gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <div
              className={`inline-block rounded border-2 px-3 py-1 text-xs font-bold tracking-wide ${statusColor}`}
            >
              {transaction.paymentStatus.toUpperCase()}
            </div>
            {transaction.notes && (
              <div className="max-w-xs text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Catatan: </span>
                {transaction.notes}
              </div>
            )}
          </div>

          <div className="w-full space-y-1.5 text-xs sm:w-64">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {formatIDR(transaction.subtotal)}
              </span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>
                  Diskon
                  {transaction.discountType === 'percent' ? ` (${transaction.discountValue}%)` : ''}
                </span>
                <span className="font-mono-tabular font-medium text-red-600">
                  -{formatIDR(transaction.discountAmount)}
                </span>
              </div>
            )}
            {transaction.taxAmount > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Pajak ({transaction.taxPercent}%)</span>
                <span className="font-mono-tabular font-medium text-slate-900">
                  {formatIDR(transaction.taxAmount)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
              <span>Total Akhir</span>
              <span className="font-mono-tabular text-base text-amber-700">
                {formatIDR(transaction.grandTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-slate-600">
              <span>Dibayar ({transaction.paymentMethod})</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {formatIDR(transaction.paidAmount)}
              </span>
            </div>

            {remaining > 0 && (
              <div className="flex items-center justify-between font-semibold text-red-600">
                <span>Sisa Tagihan</span>
                <span className="font-mono-tabular">{formatIDR(remaining)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      {profile.footerNote && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-center text-[11px] leading-relaxed text-slate-500">
          {profile.footerNote}
        </div>
      )}
    </div>
  );
};
