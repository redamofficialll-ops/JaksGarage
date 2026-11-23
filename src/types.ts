export type ItemCategory = 'Barang' | 'Jasa';

export type PaymentStatus = 'Lunas' | 'DP / Sebagian' | 'Belum Lunas';

export type PaymentMethod = 'Tunai' | 'Transfer Bank' | 'QRIS' | 'Kartu Debit/Kredit';

export interface LineItem {
  id: string;
  name: string;
  category: ItemCategory;
  qty: number;
  unit: string;
  unitPrice: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  items: LineItem[];
  discountType: 'nominal' | 'percent';
  discountValue: number;
  taxPercent: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes: string;
}

export interface WorkshopProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  footerNote: string;
  autoNotifyNewTx: boolean;
  soundAlert: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  invoiceNumber: string;
  amount: number;
  timestamp: string;
  read: boolean;
}

export type AppView = 'builder' | 'history' | 'dashboard' | 'settings';
