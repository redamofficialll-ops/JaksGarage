import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileDown,
  MessageCircle,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  ItemCategory,
  LineItem,
  PaymentMethod,
  PaymentStatus,
  Transaction,
  WorkshopProfile,
} from '../types';
import {
  buildWhatsAppMessage,
  calculateTotals,
  formatIDR,
  generateInvoiceNumber,
  sanitizeWhatsAppPhone,
} from '../utils/format';
import { downloadReceiptPDF, loadWorkshopLogoForPDF } from '../utils/pdfGenerator';
import { ReceiptPreview } from './ReceiptPreview';

interface ReceiptBuilderProps {
  existingTransactions: Transaction[];
  editingTransaction: Transaction | null;
  profile: WorkshopProfile;
  onSaveTransaction: (tx: Transaction) => Promise<void>;
  onCancelEdit: () => void;
  onStatusMessage: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

function createEmptyItem(category: ItemCategory = 'Jasa'): LineItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    category,
    qty: 1,
    unit: category === 'Jasa' ? 'paket' : 'pcs',
    unitPrice: 0,
  };
}

export const ReceiptBuilder: React.FC<ReceiptBuilderProps> = ({
  existingTransactions,
  editingTransaction,
  profile,
  onSaveTransaction,
  onCancelEdit,
  onStatusMessage,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState(() =>
    generateInvoiceNumber(existingTransactions)
  );
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [items, setItems] = useState<LineItem[]>([createEmptyItem('Jasa')]);
  const [discountType, setDiscountType] = useState<'nominal' | 'percent'>('nominal');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Lunas');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [copiedText, setCopiedText] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadWorkshopLogoForPDF();
  }, []);

  useEffect(() => {
    if (editingTransaction) {
      setInvoiceNumber(editingTransaction.invoiceNumber);
      setCreatedAt(new Date(editingTransaction.createdAt).toISOString().slice(0, 16));
      setCustomerName(editingTransaction.customerName);
      setCustomerPhone(editingTransaction.customerPhone);
      setVehicleInfo(editingTransaction.vehicleInfo);
      setItems(
        editingTransaction.items.length > 0
          ? editingTransaction.items
          : [createEmptyItem('Jasa')]
      );
      setDiscountType(editingTransaction.discountType);
      setDiscountValue(editingTransaction.discountValue);
      setPaymentStatus(editingTransaction.paymentStatus);
      setPaymentMethod(editingTransaction.paymentMethod);
      setPaidAmount(editingTransaction.paidAmount);
      setNotes(editingTransaction.notes);
    } else {
      setInvoiceNumber(generateInvoiceNumber(existingTransactions));
    }
  }, [editingTransaction]);

  const totals = useMemo(
    () => calculateTotals(items, discountType, discountValue, 0),
    [items, discountType, discountValue]
  );

  useEffect(() => {
    if (paymentStatus === 'Lunas') {
      setPaidAmount(totals.grandTotal);
    } else if (paymentStatus === 'Belum Lunas') {
      setPaidAmount(0);
    }
  }, [paymentStatus, totals.grandTotal]);

  const draftTransaction: Transaction = useMemo(
    () => ({
      id: editingTransaction?.id || `tx-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim() || generateInvoiceNumber(existingTransactions),
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      vehicleInfo: vehicleInfo.trim(),
      items: items.map((i) => ({
        ...i,
        name: i.name.trim(),
        qty: Math.max(0, Number(i.qty) || 0),
        unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      })),
      discountType,
      discountValue: Math.max(0, Number(discountValue) || 0),
      taxPercent: 0,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      paidAmount:
        paymentStatus === 'Lunas'
          ? totals.grandTotal
          : paymentStatus === 'Belum Lunas'
          ? 0
          : Math.min(totals.grandTotal, Math.max(0, Number(paidAmount) || 0)),
      paymentStatus,
      paymentMethod,
      notes: notes.trim(),
    }),
    [
      editingTransaction,
      invoiceNumber,
      existingTransactions,
      createdAt,
      customerName,
      customerPhone,
      vehicleInfo,
      items,
      discountType,
      discountValue,
      totals,
      paymentStatus,
      paidAmount,
      paymentMethod,
      notes,
    ]
  );

  const handleAddItem = (category: ItemCategory) => {
    setItems((prev) => [...prev, createEmptyItem(category)]);
  };

  const handleUpdateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [createEmptyItem('Jasa')];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const resetForm = () => {
    onCancelEdit();
    setInvoiceNumber(generateInvoiceNumber(existingTransactions));
    setCreatedAt(new Date().toISOString().slice(0, 16));
    setCustomerName('');
    setCustomerPhone('');
    setVehicleInfo('');
    setItems([createEmptyItem('Jasa')]);
    setDiscountType('nominal');
    setDiscountValue(0);
    setPaymentStatus('Lunas');
    setPaymentMethod('Tunai');
    setPaidAmount(0);
    setNotes('');
  };

  const validateDraft = (): boolean => {
    const validItems = draftTransaction.items.filter((i) => i.name.length > 0);
    if (validItems.length === 0) {
      onStatusMessage('Tambahkan minimal 1 nama barang atau jasa terlebih dahulu.', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateDraft()) return;
    setSaving(true);
    try {
      const cleanedTx: Transaction = {
        ...draftTransaction,
        items: draftTransaction.items.filter((i) => i.name.length > 0),
      };
      await onSaveTransaction(cleanedTx);
      if (!editingTransaction) {
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWhatsAppText = async () => {
    const text = buildWhatsAppMessage(draftTransaction, profile);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      onStatusMessage('Teks nota disalin ke clipboard.', 'success');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      onStatusMessage('Gagal menyalin teks ke clipboard.', 'error');
    }
  };

  const waUrl = useMemo(() => {
    const sanitizedPhone = sanitizeWhatsAppPhone(draftTransaction.customerPhone);
    const message = encodeURIComponent(buildWhatsAppMessage(draftTransaction, profile));
    return sanitizedPhone
      ? `https://wa.me/${sanitizedPhone}?text=${message}`
      : `https://wa.me/?text=${message}`;
  }, [draftTransaction, profile]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!validateDraft()) return;
    await downloadReceiptPDF(draftTransaction, profile);
    onStatusMessage(`PDF ${draftTransaction.invoiceNumber} berhasil diunduh.`, 'success');
  };

  const handleSendWhatsApp = async () => {
    if (!validateDraft()) return;
    await downloadReceiptPDF(draftTransaction, profile);
    navigator.clipboard
      .writeText(buildWhatsAppMessage(draftTransaction, profile))
      .catch(() => {});
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onStatusMessage(
      'PDF nota diunduh & teks disalin! Lampirkan PDF ke chat WhatsApp.',
      'success'
    );
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Mobile Mode Switch */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {editingTransaction ? `Edit Nota ${editingTransaction.invoiceNumber}` : 'Buat Nota Pembayaran'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Input manual barang dan jasa secara bebas, total terhitung otomatis secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`min-h-[40px] flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mobileTab === 'form'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Input Nota
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`min-h-[40px] flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mobileTab === 'preview'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pratinjau Nota
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left: Manual Input Form */}
        <div
          className={`no-print space-y-5 lg:col-span-7 ${
            mobileTab === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Section 1: Customer & Invoice Metadata */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">1. Informasi Nota & Pelanggan</h2>
              {editingTransaction ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2"
                >
                  Batalkan Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Form
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">No. Nota</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="font-mono-tabular mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-amber-600 focus:bg-white focus:outline-none"
                  placeholder="JG-202611-0001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Tanggal & Jam</label>
                <input
                  type="datetime-local"
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                  className="font-mono-tabular mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Nama Pelanggan</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  No. WhatsApp Pelanggan
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="font-mono-tabular mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  placeholder="081234567890"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Kendaraan / Plat Nomor / Referensi
                </label>
                <input
                  type="text"
                  value={vehicleInfo}
                  onChange={(e) => setVehicleInfo(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  placeholder="Contoh: Honda Vario 160 · B 4521 XYZ"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Manual Line Items */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">2. Rincian Barang & Jasa</h2>
                <p className="text-xs text-slate-500">
                  Ketik manual item apa saja beserta jumlah dan harga satuan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddItem('Barang')}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-600" />
                  Tambah Barang
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('Jasa')}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-400" />
                  Tambah Jasa
                </button>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono-tabular pt-2 text-xs font-semibold text-slate-400">
                      #{idx + 1}
                    </span>

                    <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-12">
                      <div className="sm:col-span-5">
                        <label className="mb-1 block text-[11px] font-medium text-slate-500 sm:hidden">
                          Nama Barang / Jasa
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                          placeholder={
                            item.category === 'Jasa'
                              ? 'Contoh: Tune Up & Servis CVT'
                              : 'Contoh: Oli Mesin 10W-40'
                          }
                          className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:col-span-7 sm:grid-cols-7">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-slate-500 sm:hidden">
                            Tipe
                          </label>
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                category: e.target.value as ItemCategory,
                              })
                            }
                            aria-label="Kategori item"
                            className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-800 focus:border-amber-600 focus:outline-none"
                          >
                            <option value="Barang">Barang</option>
                            <option value="Jasa">Jasa</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-[11px] font-medium text-slate-500 sm:hidden">
                            Qty
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { qty: Number(e.target.value) })
                            }
                            aria-label="Kuantitas"
                            className="font-mono-tabular min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-right text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-[11px] font-medium text-slate-500 sm:hidden">
                            Satuan
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                            placeholder="pcs"
                            aria-label="Satuan"
                            className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 focus:border-amber-600 focus:outline-none"
                          />
                        </div>

                        <div className="col-span-3 sm:col-span-3">
                          <label className="mb-1 block text-[11px] font-medium text-slate-500 sm:hidden">
                            Harga Satuan (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={item.unitPrice || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { unitPrice: Number(e.target.value) || 0 })
                            }
                            placeholder="Harga Rp"
                            aria-label="Harga satuan"
                            className="font-mono-tabular min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-sm font-medium text-slate-900 focus:border-amber-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Hapus baris item"
                      className="flex min-h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-1.5 flex items-center justify-end pr-12 text-xs text-slate-500">
                    <span>Subtotal baris: </span>
                    <span className="font-mono-tabular ml-1.5 font-semibold text-slate-800">
                      {formatIDR((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Discount & Payment */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              3. Diskon & Pembayaran
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Diskon</label>
                <div className="mt-1.5 flex">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'nominal' | 'percent')}
                    aria-label="Tipe diskon"
                    className="min-h-[44px] rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="nominal">Rp</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="font-mono-tabular min-h-[44px] w-full rounded-r-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Metode Bayar</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Kartu Debit/Kredit">Kartu Debit/Kredit</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Status Pembayaran</label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {(['Lunas', 'DP / Sebagian', 'Belum Lunas'] as PaymentStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPaymentStatus(st)}
                      className={`min-h-[38px] rounded-md px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        paymentStatus === st
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Nominal Dibayar (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={paidAmount}
                  disabled={paymentStatus !== 'DP / Sebagian'}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  className="font-mono-tabular mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700">
                Catatan Garansi / Mekanik (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Ganti oli selanjutnya pada KM 18.500. Garansi servis 7 hari."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              />
            </div>

            {/* Save Button */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs text-slate-500">Total Tagihan</p>
                <p className="font-mono-tabular text-xl font-bold text-slate-900">
                  {formatIDR(totals.grandTotal)}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Save className="h-4 w-4" />
                {saving
                  ? 'Menyimpan...'
                  : editingTransaction
                  ? 'Perbarui Nota'
                  : 'Simpan Transaksi'}
              </button>
            </div>
          </section>
        </div>

        {/* Right: Live Official Receipt Preview + Export Actions */}
        <div
          className={`lg:col-span-5 lg:sticky lg:top-6 ${
            mobileTab === 'form' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Pratinjau Nota Langsung
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <FileDown className="h-3.5 w-3.5 text-amber-600" />
                Unduh PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5 text-slate-700" />
                Cetak
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Kirim WhatsApp
              </button>
              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                aria-label="Salin teks nota"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {copiedText ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedText ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          <ReceiptPreview
            transaction={draftTransaction}
            profile={profile}
            printableId="printable-receipt-area"
          />
        </div>
      </div>
    </div>
  );
};
