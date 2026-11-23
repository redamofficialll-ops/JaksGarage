import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Database,
  ShieldCheck,
} from 'lucide-react';
import {
  Transaction,
  WorkshopProfile,
} from '../types';
import { exportTransactionsCSV } from '../utils/format';
import { requestBrowserNotificationPermission } from '../utils/notifications';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsAndSyncProps {
  profile: WorkshopProfile;
  transactions: Transaction[];
  onSaveProfile: (next: WorkshopProfile) => Promise<void>;
  onStatusMessage: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsAndSync: React.FC<SettingsAndSyncProps> = ({
  profile,
  transactions,
  onSaveProfile,
  onStatusMessage,
}) => {
  const [formProfile, setFormProfile] = useState<WorkshopProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setFormProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm('unsupported');
    }
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveProfile(formProfile);
      onStatusMessage('Profil bengkel dan preferensi notifikasi disimpan.', 'success');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEnableNotifications = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifPerm(res);
    if (res === 'granted') {
      onStatusMessage('Notifikasi browser aktif untuk transaksi baru.', 'success');
    } else if (res === 'denied') {
      onStatusMessage('Izin notifikasi ditolak browser. Notifikasi tetap tampil di dalam aplikasi.', 'info');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Pengaturan & Privasi
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Kelola identitas nota, notifikasi transaksi, mode offline PWA, dan ekspor data lokal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Card 1: Workshop Identity & Real-Time Notifications */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Identitas Nota & Notifikasi</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ubah informasi header/footer nota JaksGarage serta pengingat transaksi baru otomatis.
              </p>
            </div>
            <Bell className="h-5 w-5 shrink-0 text-amber-600" />
          </div>

          <form onSubmit={handleProfileSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700">Nama Usaha / Nota</label>
              <input
                type="text"
                value={formProfile.name}
                onChange={(e) => setFormProfile({ ...formProfile, name: e.target.value })}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Tagline Usaha</label>
              <input
                type="text"
                value={formProfile.tagline}
                onChange={(e) => setFormProfile({ ...formProfile, tagline: e.target.value })}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Alamat Bengkel</label>
                <input
                  type="text"
                  value={formProfile.address}
                  onChange={(e) => setFormProfile({ ...formProfile, address: e.target.value })}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Telepon / WhatsApp</label>
                <input
                  type="text"
                  value={formProfile.phone}
                  onChange={(e) => setFormProfile({ ...formProfile, phone: e.target.value })}
                  className="font-mono-tabular mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Catatan Footer Nota</label>
              <textarea
                rows={2}
                value={formProfile.footerNote}
                onChange={(e) => setFormProfile({ ...formProfile, footerNote: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 text-xs font-medium text-slate-700">
                <span>Notifikasi otomatis setiap transaksi baru masuk</span>
                <input
                  type="checkbox"
                  checked={formProfile.autoNotifyNewTx}
                  onChange={(e) =>
                    setFormProfile({ ...formProfile, autoNotifyNewTx: e.target.checked })
                  }
                  className="h-4 w-4 accent-amber-600"
                />
              </label>
              <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 text-xs font-medium text-slate-700">
                <span>Putar suara pengingat transaksi baru</span>
                <input
                  type="checkbox"
                  checked={formProfile.soundAlert}
                  onChange={(e) =>
                    setFormProfile({ ...formProfile, soundAlert: e.target.checked })
                  }
                  className="h-4 w-4 accent-amber-600"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              {notifPerm !== 'granted' && notifPerm !== 'unsupported' ? (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Izinkan Notifikasi Browser
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  Notifikasi browser: {notifPerm === 'granted' ? 'Aktif' : 'Hanya dalam aplikasi'}
                </span>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingProfile ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>
        </section>

        {/* Card 2: Offline PWA, Local Privacy & CSV Export */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mode Offline, Privasi & Ekspor CSV</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Arsitektur 100% lokal tanpa koneksi ke server luar, Spreadsheet, maupun Drive.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2.5 text-xs leading-relaxed text-slate-600">
              <div className="flex items-start gap-2.5">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                <p>
                  <strong className="text-slate-900">Privasi Lokal Penuh:</strong> Seluruh data nota, profil bengkel, dan notifikasi tersimpan langsung di IndexedDB perangkat Anda tanpa server eksternal.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>
                  <strong className="text-slate-900">Bekerja Tanpa Internet:</strong> Service Worker PWA menyimpan antarmuka aplikasi agar tetap dapat membuat nota, mengunduh PDF, dan mengekspor Excel/CSV saat offline.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-800">Instalasi Aplikasi (PWA)</p>
              <PWAInstallButton />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-800">
                Ekspor Seluruh Riwayat (CSV)
              </p>
              <button
                type="button"
                disabled={transactions.length === 0}
                onClick={() => exportTransactionsCSV(transactions, 'jaksgarage-semua-transaksi')}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                Ekspor Seluruh Riwayat ke CSV ({transactions.length} Transaksi)
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
