import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  FilePlus2,
  History,
  Lock,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { MonthlyDashboard } from './components/MonthlyDashboard';
import { NotificationCenter } from './components/NotificationCenter';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReceiptBuilder } from './components/ReceiptBuilder';
import { SettingsAndSync } from './components/SettingsAndSync';
import { TransactionHistory } from './components/TransactionHistory';
import {
  AppNotification,
  AppView,
  BiometricConfig,
  Transaction,
  WorkshopProfile,
} from './types';
import {
  createTransactionNotification,
  dispatchSystemNotification,
  playTransactionChime,
} from './utils/notifications';
import { loadWorkshopLogoForPDF } from './utils/pdfGenerator';
import {
  deleteTransactionLocal,
  getAllTransactions,
  getBiometricConfig,
  getNotifications,
  getWorkshopProfile,
  saveBiometricConfig,
  saveNotifications,
  saveTransactionLocal,
  saveWorkshopProfile,
} from './utils/storage';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  action: () => Promise<void>;
}

interface ToastState {
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('builder');
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [profile, setProfile] = useState<WorkshopProfile>({
    name: 'JaksGarage',
    tagline: 'Spesialis Servis, Modifikasi & Suku Cadang Otomotif',
    address:
      'Jl. Pangkalan Jati 2 No.69, RT.01/RW.06, Pangkalan Jati, Kec. CinereKota, Kota Depok, Jawa Barat 16514',
    phone: '085921229428',
    footerNote: 'Terima kasih atas kepercayaan Anda. Garansi servis berlaku 7 hari dengan menyertakan nota ini.',
    autoNotifyNewTx: true,
    soundAlert: true,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [biometricConfig, setBiometricConfig] = useState<BiometricConfig>({ enabled: false });
  const [isLocked, setIsLocked] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Konfirmasi',
    variant: 'primary',
    action: async () => {},
  });
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      setToast({ message, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load local IndexedDB data and warm logo cache for instant PDF export
  useEffect(() => {
    void loadWorkshopLogoForPDF();
    let active = true;
    Promise.all([
      getAllTransactions(),
      getWorkshopProfile(),
      getNotifications(),
      getBiometricConfig(),
    ]).then(([txList, loadedProfile, notifs, bio]) => {
      if (!active) return;
      setTransactions(txList);
      setProfile(loadedProfile);
      setNotifications(notifs);
      setBiometricConfig(bio);
      if (bio.enabled && (bio.credentialId || bio.pinHash)) {
        setIsLocked(true);
      }
      setLoadingInitial(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const triggerTransactionNotification = async (tx: Transaction, isUpdate: boolean) => {
    if (!profile.autoNotifyNewTx) return;
    const notif = createTransactionNotification(tx, isUpdate);
    const nextList = [notif, ...notifications].slice(0, 60);
    setNotifications(nextList);
    await saveNotifications(nextList);

    if (profile.soundAlert) {
      playTransactionChime();
    }
    dispatchSystemNotification(notif);
  };

  const handleSaveTransaction = async (tx: Transaction) => {
    const isUpdate = transactions.some((t) => t.id === tx.id);

    await saveTransactionLocal(tx);
    setTransactions((prev) => {
      const without = prev.filter((item) => item.id !== tx.id);
      return [tx, ...without].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    setEditingTx(null);

    await triggerTransactionNotification(tx, isUpdate);
    showToast(
      isUpdate
        ? `Nota ${tx.invoiceNumber} berhasil diperbarui secara lokal.`
        : `Nota ${tx.invoiceNumber} berhasil disimpan di perangkat lokal.`,
      'success'
    );
  };

  const handleRequestDeleteTransaction = (tx: Transaction) => {
    setConfirmState({
      open: true,
      title: `Hapus Nota ${tx.invoiceNumber}?`,
      description: `Nota milik ${tx.customerName || 'Pelanggan Umum'} akan dihapus permanen dari penyimpanan lokal perangkat ini.`,
      confirmLabel: 'Hapus Permanen',
      variant: 'danger',
      action: async () => {
        await deleteTransactionLocal(tx.id);
        setTransactions((prev) => prev.filter((item) => item.id !== tx.id));
        showToast(`Nota ${tx.invoiceNumber} telah dihapus.`, 'info');
      },
    });
  };

  const handleConfirmProceed = async () => {
    setConfirmBusy(true);
    try {
      await confirmState.action();
    } finally {
      setConfirmBusy(false);
      setConfirmState((prev) => ({ ...prev, open: false }));
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <p className="text-sm font-medium text-slate-600">Memuat data lokal JaksGarage...</p>
      </div>
    );
  }

  if (isLocked && biometricConfig.enabled) {
    return (
      <BiometricLockScreen
        config={biometricConfig}
        onUnlock={() => setIsLocked(false)}
      />
    );
  }

  const navItems: { id: AppView; label: string; icon: typeof FilePlus2 }[] = [
    { id: 'builder', label: 'Buat Nota', icon: FilePlus2 },
    { id: 'history', label: 'Riwayat', icon: History },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-20 text-slate-900 md:pb-10">
      <OfflineIndicator />

      {/* Top Bar Contract: Brand | Nav | Actions */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-6 sm:px-6 lg:gap-8">
          {/* Zone 1: Brand Logo & Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('builder')}
            className="flex items-center gap-1.5 text-slate-900 whitespace-nowrap shrink-0 sm:gap-2.5"
          >
            <img
              src="/workshop-logo.png"
              alt="Jaks Garage"
              className="h-6 w-auto max-w-[96px] rounded object-contain sm:h-8 sm:max-w-[140px]"
            />
            <span className="font-display text-[15px] font-bold tracking-tight sm:text-lg">
              JaksGarage
            </span>
          </button>

          {/* Zone 2: 4 single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navigasi utama">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-amber-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Actions (Lock, Notifications, New Receipt CTA) */}
          <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
            {biometricConfig.enabled && (
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                title="Kunci Aplikasi"
                aria-label="Kunci aplikasi"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shrink-0 sm:h-10 sm:w-10"
              >
                <Lock className="h-4 w-4 text-amber-600" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              title="Pusat Notifikasi"
              aria-label={`Buka pusat notifikasi transaksi${unreadNotifCount > 0 ? ` (${unreadNotifCount} belum dibaca)` : ''}`}
              className="relative inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shrink-0 sm:h-10 sm:w-10 lg:w-auto lg:px-3"
            >
              <Bell className="h-4 w-4 text-slate-700" />
              <span className="hidden lg:inline">Notifikasi</span>
              {unreadNotifCount > 0 && (
                <span className="font-mono-tabular absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white lg:static lg:ring-0">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setActiveView('builder');
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 sm:h-10 sm:gap-1.5 sm:px-3.5"
            >
              <Plus className="h-3.5 w-3.5 text-amber-400" />
              <span>Nota Baru</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        {activeView === 'builder' && (
          <ReceiptBuilder
            existingTransactions={transactions}
            editingTransaction={editingTx}
            profile={profile}
            onSaveTransaction={handleSaveTransaction}
            onCancelEdit={() => setEditingTx(null)}
            onStatusMessage={showToast}
          />
        )}

        {activeView === 'history' && (
          <TransactionHistory
            transactions={transactions}
            profile={profile}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setActiveView('builder');
            }}
            onRequestDeleteTransaction={handleRequestDeleteTransaction}
            onGoToBuilder={() => setActiveView('builder')}
            onStatusMessage={showToast}
          />
        )}

        {activeView === 'dashboard' && (
          <MonthlyDashboard
            transactions={transactions}
            profile={profile}
            onGoToBuilder={() => setActiveView('builder')}
            onStatusMessage={showToast}
          />
        )}

        {activeView === 'settings' && (
          <SettingsAndSync
            profile={profile}
            transactions={transactions}
            biometricConfig={biometricConfig}
            onSaveProfile={async (next) => {
              await saveWorkshopProfile(next);
              setProfile(next);
            }}
            onUpdateBiometric={async (next) => {
              await saveBiometricConfig(next);
              setBiometricConfig(next);
            }}
            onLockNow={() => setIsLocked(true)}
            onStatusMessage={showToast}
          />
        )}
      </main>

      {/* Clean Local Privacy & Offline Footer */}
      <footer className="no-print mx-auto max-w-7xl px-4 pb-4 pt-1 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-2.5 border-t border-slate-200/80 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Penyimpanan Lokal Privat · Offline Siap
          </span>
          <PWAInstallButton />
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <nav
        aria-label="Navigasi seluler"
        className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden pb-safe"
      >
        <div className="grid h-16 grid-cols-4 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-amber-700 font-semibold' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Real-time Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-20 right-4 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-lg md:bottom-6"
        >
          <CheckCircle2
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              toast.type === 'error'
                ? 'text-red-400'
                : toast.type === 'success'
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          />
          <p className="leading-relaxed">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup pesan"
            className="ml-1 shrink-0 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Notification Slide-Over */}
      <NotificationCenter
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkAllRead={async () => {
          const updated = notifications.map((n) => ({ ...n, read: true }));
          setNotifications(updated);
          await saveNotifications(updated);
        }}
        onClearAll={async () => {
          setNotifications([]);
          await saveNotifications([]);
        }}
      />

      {/* Confirmation Dialog for Local Delete */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        busy={confirmBusy}
        onConfirm={handleConfirmProceed}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
