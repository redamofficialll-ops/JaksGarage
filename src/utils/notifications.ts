import { AppNotification, Transaction } from '../types';
import { formatIDR } from './format';

export function playTransactionChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 crisp confirmation chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.001, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.09, now + i * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.26);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return Notification.requestPermission();
}

export function createTransactionNotification(tx: Transaction, isUpdate = false): AppNotification {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: isUpdate ? 'Transaksi Diperbarui' : 'Transaksi Baru Masuk',
    message: `${tx.invoiceNumber} · ${tx.customerName || 'Pelanggan Umum'} · ${formatIDR(tx.grandTotal)} (${tx.paymentStatus})`,
    invoiceNumber: tx.invoiceNumber,
    amount: tx.grandTotal,
    timestamp: new Date().toISOString(),
    read: false,
  };
}

export async function dispatchSystemNotification(notif: AppNotification): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(`Jaks Gerage — ${notif.title}`, {
          body: notif.message,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: notif.invoiceNumber,
        });
        return;
      }
    }
    new Notification(`Jaks Gerage — ${notif.title}`, {
      body: notif.message,
      icon: '/pwa-192x192.png',
    });
  } catch {
    // Silent fallback when browser blocks system notification in iframe
  }
}
