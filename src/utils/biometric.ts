function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashPinLocal(pin: string): Promise<string> {
  const encoded = new TextEncoder().encode(`jaks_gerage_local_pin_v1:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToBase64Url(digest);
}

export async function isPlatformBiometricSupported(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof PublicKeyCredential === 'undefined' ||
    !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  ) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerLocalBiometric(): Promise<{ credentialId: string; deviceLabel: string }> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'JaksGarage',
      },
      user: {
        id: userId,
        name: 'pemilik@jaksgerage.local',
        displayName: 'Pemilik Jaks Gerage',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Pendaftaran biometrik dibatalkan oleh pengguna.');
  }

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    deviceLabel: navigator.platform || 'Perangkat Lokal',
  };
}

export async function verifyLocalBiometric(credentialId: string): Promise<boolean> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const rawId = base64UrlToUint8Array(credentialId);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: rawId.buffer as ArrayBuffer,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  return Boolean(assertion);
}
