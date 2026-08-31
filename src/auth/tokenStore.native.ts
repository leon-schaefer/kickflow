/**
 * Native-Implementierung: Token liegt in expo-secure-store (Keychain/Keystore).
 */
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'kickflow.session.v1';

export interface StoredSession {
  token: string;
  refreshToken: string | null;
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function setSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
