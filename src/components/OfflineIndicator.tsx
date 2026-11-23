import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700" />
      <span>Mode Offline Aktif — Nota dan riwayat tetap tersimpan lokal dan siap disinkronkan saat online.</span>
    </div>
  );
};
