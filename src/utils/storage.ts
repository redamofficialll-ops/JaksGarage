import {
  AppNotification,
  Transaction,
  WorkshopProfile,
} from '../types';

const DB_NAME = 'jaks_gerage_local_db';
const DB_VERSION = 1;
const STORE_TRANSACTIONS = 'transactions';
const STORE_KV = 'kv_store';

const NEW_DEFAULT_ADDRESS =
  'Jl. Pangkalan Jati 2 No.69, RT.01/RW.06, Pangkalan Jati, Kec. CinereKota, Kota Depok, Jawa Barat 16514';

const NEW_DEFAULT_PHONE = '085921229428';

const DEFAULT_PROFILE: WorkshopProfile = {
  name: 'JaksGarage',
  tagline: 'Spesialis Servis, Modifikasi & Suku Cadang Otomotif',
  address: NEW_DEFAULT_ADDRESS,
  phone: NEW_DEFAULT_PHONE,
  footerNote: 'Terima kasih atas kepercayaan Anda. Garansi servis berlaku 7 hari dengan menyertakan nota ini.',
  autoNotifyNewTx: true,
  soundAlert: true,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDB();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as T) : fallback);
      };
      req.onerror = () => resolve(fallback);
    });
  } catch {
    try {
      const raw = localStorage.getItem(`jg_${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`jg_${key}`, JSON.stringify(value));
  }
}

export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const db = await openDB();
    const list = await new Promise<Transaction[]>((resolve) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
      const req = tx.objectStore(STORE_TRANSACTIONS).getAll();
      req.onsuccess = () => resolve((req.result as Transaction[]) || []);
      req.onerror = () => resolve([]);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    try {
      const raw = localStorage.getItem('jg_transactions');
      const list = raw ? (JSON.parse(raw) as Transaction[]) : [];
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }
}

export async function saveTransactionLocal(transaction: Transaction): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).put(transaction);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllTransactions();
    const filtered = existing.filter((t) => t.id !== transaction.id);
    localStorage.setItem('jg_transactions', JSON.stringify([transaction, ...filtered]));
  }
}

export async function deleteTransactionLocal(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllTransactions();
    localStorage.setItem(
      'jg_transactions',
      JSON.stringify(existing.filter((t) => t.id !== id))
    );
  }
}

export async function getWorkshopProfile(): Promise<WorkshopProfile> {
  const saved = await kvGet<Partial<WorkshopProfile>>('workshop_profile', {});
  const merged = { ...DEFAULT_PROFILE, ...saved };
  let migrated = false;
  if (merged.address === 'Jl. Raya Bengkel No. 88, Indonesia') {
    merged.address = NEW_DEFAULT_ADDRESS;
    migrated = true;
  }
  if (merged.phone === '0812-0000-0000') {
    merged.phone = NEW_DEFAULT_PHONE;
    migrated = true;
  }
  if (migrated) {
    await kvSet('workshop_profile', merged);
  }
  return merged;
}

export async function saveWorkshopProfile(profile: WorkshopProfile): Promise<void> {
  await kvSet('workshop_profile', profile);
}

export async function getNotifications(): Promise<AppNotification[]> {
  return kvGet<AppNotification[]>('notifications', []);
}

export async function saveNotifications(items: AppNotification[]): Promise<void> {
  await kvSet('notifications', items.slice(0, 60));
}
