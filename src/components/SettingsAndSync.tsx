import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Database,
  Fingerprint,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  BiometricConfig,
  Transaction,
  WorkshopProfile,
} from '../types';
import {
  hashPinLocal,
  isPlatformBiometricSupported,
  registerLocalBiometric,
} from '../utils/biometric';
import { exportTransactionsCSV } from '../utils/format';
import { requestBrowserNotificationPermission } from '../utils/notifications';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsAndSyncProps {
  profile: WorkshopProfile;
  transactions: Transaction[];
  biometricConfig: BiometricConfig;
  onSaveProfile: (next: WorkshopProfile) => Promise<void>;
  onUpdateBiometric: (next: BiometricConfig) => Promise<void>;
  onLockNow: () => void;
  onStatusMessage: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsAndSync: React.FC<SettingsAndSyncProps> = ({
  profile,
  transactions,
  biometricConfig,
  onSaveProfile,
  onUpdateBiometric,
  onLockNow,
  onStatusMessage,
}) => {
  const [formProfile, setFormProfile] = useState<WorkshopProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [bioBusy, setBioBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setFormProfile(profile);
  }, [profile]);

  useEffect(() => {
    isPlatformBiometricSupported().then(setBioSupported);
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

  const handleRegisterBiometric = async () => {
    setBioBusy(true);
    try {
      const reg = await registerLocalBiometric();
      await onUpdateBiometric({
        ...biometricConfig,
        enabled: true,
        credentialId: reg.credentialId,
        deviceLabel: reg.deviceLabel,
        updatedAt: new Date().toISOString(),
      });
      onStatusMessage('Autentikasi biometrik perangkat berhasil didaftarkan secara lokal.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftarkan biometrik.';
      onStatusMessage(
        `${msg} Gunakan PIN 6 digit sebagai pengaman lokal alternatif.`,
        'error'
      );
    } finally {
      setBioBusy(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pinDraft)) {
      onStatusMessage('PIN harus terdiri dari tepat 6 angka.', 'error');
      return;
    }
    const pinHash = await hashPinLocal(pinDraft);
    await onUpdateBiometric({
      ...biometricConfig,
      enabled: true,
      pinHash,
      updatedAt: new Date().toISOString(),
    });
    setPinDraft('');
    onStatusMessage('PIN 6 digit lokal berhasil disimpan dan diaktifkan.', 'success');
  };

  const handleDisableSecurity = async () => {
    await onUpdateBiometric({
      enabled: false,
      updatedAt: new Date().toISOString(),
    });
    onStatusMessage('Kunci keamanan biometrik/PIN dinonaktifkan.', 'info');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Keamanan & Pengaturan
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Kelola identitas nota, kunci biometrik lokal, notifikasi transaksi, mode offline PWA, dan ekspor data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Workshop Identity & Real-Time Notifications */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Identitas Nota & Notifikasi</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ubah informasi header/footer nota Jaks Gerage serta pengingat transaksi baru otomatis.
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

        {/* Card 2: Biometric & Local Security + Offline PWA */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Keamanan Biometrik & PIN Lokal</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Lindungi data transaksi dengan sidik jari / Face ID / Windows Hello atau PIN 6 digit lokal.
                </p>
              </div>
              <Fingerprint className="h-5 w-5 shrink-0 text-amber-600" />
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">
                    Status Kunci: {biometricConfig.enabled ? 'Aktif' : 'Nonaktif'}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {[
                      biometricConfig.credentialId ? 'Biometrik Terdaftar' : null,
                      biometricConfig.pinHash ? 'PIN 6 Digit Aktif' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Belum ada kunci lokal terdaftar'}
                  </p>
                </div>
                {biometricConfig.enabled && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onLockNow}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                      Kunci Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={handleDisableSecurity}
                      className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap shrink-0"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  disabled={bioBusy}
                  onClick={handleRegisterBiometric}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Fingerprint className="h-4 w-4 text-amber-600" />
                  {bioBusy
                    ? 'Memproses Sensor Biometrik...'
                    : biometricConfig.credentialId
                    ? 'Daftarkan Ulang Biometrik Perangkat'
                    : bioSupported
                    ? 'Aktifkan Sidik Jari / Face ID (WebAuthn)'
                    : 'Coba Daftarkan Biometrik Perangkat'}
                </button>
              </div>

              <form onSubmit={handleSavePin} className="space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-700">
                  {biometricConfig.pinHash ? 'Ubah PIN Lokal (6 Angka)' : 'Atur PIN Lokal (6 Angka)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinDraft}
                    onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 digit angka"
                    className="font-mono-tabular min-h-[44px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    Simpan PIN
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  PIN di-hash dengan SHA-256 dan disimpan hanya di perangkat Anda.
                </p>
              </form>
            </div>
          </section>

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
                    <strong className="text-slate-900">Privasi Lokal Penuh:</strong> Seluruh data nota, profil bengkel, notifikasi, dan kredensial biometrik tersimpan langsung di IndexedDB perangkat Anda tanpa server eksternal.
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
                  onClick={() => exportTransactionsCSV(transactions, 'jaks-gerage-semua-transaksi')}
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  Ekspor Seluruh Riwayat ke CSV ({transactions.length} Transaksi)
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
