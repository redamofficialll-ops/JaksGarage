import React, { useState } from 'react';
import { Fingerprint, Lock, ShieldCheck, Delete } from 'lucide-react';
import { BiometricConfig } from '../types';
import { hashPinLocal, verifyLocalBiometric } from '../utils/biometric';

interface BiometricLockScreenProps {
  config: BiometricConfig;
  onUnlock: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ config, onUnlock }) => {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifyingBio, setVerifyingBio] = useState(false);

  const handleBiometricUnlock = async () => {
    if (!config.credentialId) return;
    setError(null);
    setVerifyingBio(true);
    try {
      const ok = await verifyLocalBiometric(config.credentialId);
      if (ok) {
        onUnlock();
      } else {
        setError('Verifikasi biometrik gagal. Silakan coba lagi atau gunakan PIN lokal.');
      }
    } catch {
      setError('Sensor biometrik dibatalkan atau tidak tersedia di konteks ini. Gunakan PIN 6 digit.');
    } finally {
      setVerifyingBio(false);
    }
  };

  const handleDigit = async (digit: string) => {
    if (pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    setError(null);

    if (next.length === 6 && config.pinHash) {
      const hashed = await hashPinLocal(next);
      if (hashed === config.pinHash) {
        onUnlock();
      } else {
        setError('PIN tidak cocok. Silakan periksa kembali.');
        setPinInput('');
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F7F8FA] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">JaksGarage Terkunci</h1>
          <p className="mt-1 text-xs text-slate-500">
            Autentikasi lokal untuk membuka catatan transaksi dan nota pembayaran.
          </p>
        </div>

        {config.credentialId && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={verifyingBio}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            <Fingerprint className="h-5 w-5 text-amber-400" />
            {verifyingBio ? 'Memverifikasi Biometrik...' : 'Buka dengan Biometrik Perangkat'}
          </button>
        )}

        {config.pinHash && (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`h-3 w-3 rounded-full border transition-colors ${
                    idx < pinInput.length
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">Masukkan 6 digit PIN lokal</p>

            {error && (
              <p className="mt-2 text-center text-xs font-medium text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-mono-tabular text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-mono-tabular text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Hapus digit PIN"
                className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 active:bg-slate-100"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {error && !config.pinHash && (
          <p className="mt-3 text-center text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Verifikasi 100% lokal di perangkat tanpa server luar</span>
        </div>
      </div>
    </div>
  );
};
