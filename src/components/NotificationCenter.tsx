import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { AppNotification } from '../types';
import { formatDateTimeID } from '../utils/format';

interface NotificationCenterProps {
  open: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  notifications,
  onClose,
  onMarkAllRead,
  onClearAll,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Pusat notifikasi transaksi"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Pengingat Transaksi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel notifikasi"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
            Tandai semua dibaca
          </button>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="font-medium text-slate-500 hover:text-red-600"
            >
              Bersihkan
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-slate-900">Belum ada notifikasi transaksi</p>
              <p className="mt-1 text-xs text-slate-500">
                Pengingat real-time akan muncul otomatis di sini setiap kali transaksi baru dicatat.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-5 py-3.5 ${n.read ? 'bg-white' : 'bg-amber-50/40'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{n.title}</p>
                  {!n.read && (
                    <span className="text-[11px] font-semibold text-amber-700">Baru</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{n.message}</p>
                <p className="font-mono-tabular mt-1.5 text-[11px] text-slate-400">
                  {formatDateTimeID(n.timestamp)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
