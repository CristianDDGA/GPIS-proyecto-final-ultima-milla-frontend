import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_BASE_URL = 'http://10.0.2.2:3000';

const TOKEN_STORAGE_KEY = '@millast/mobile-jwt';
const API_URL_STORAGE_KEY = '@millast/mobile-api-url';
const LEGACY_CONFIG_KEY = '@gpis-ultima-milla/mobile-route-config';

export function normalizeApiUrl(value: string): string {
  const cleaned = value.trim().replace(/\/+$/, '');
  return cleaned.length > 0 ? cleaned : DEFAULT_API_BASE_URL;
}

export async function loadStoredToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    return token && token.trim().length > 0 ? token.trim() : null;
  } catch {
    return null;
  }
}

export async function saveStoredToken(token: string | null): Promise<void> {
  if (token === null || token.trim().length === 0) {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export async function loadStoredApiUrl(): Promise<string> {
  try {
    const direct = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
    if (direct && direct.trim().length > 0) {
      return normalizeApiUrl(direct);
    }
    // Migración transparente si el usuario venía de una configuración previa no obsoleta.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_CONFIG_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as {apiUrl?: unknown};
      if (typeof parsed.apiUrl === 'string' && !parsed.apiUrl.includes(':3012')) {
        return normalizeApiUrl(parsed.apiUrl);
      }
    }
  } catch {
    // Fallback al endpoint por defecto del emulador Android contra backend unificado :3000.
  }
  return DEFAULT_API_BASE_URL;
}

export async function saveStoredApiUrl(url: string): Promise<string> {
  const normalized = normalizeApiUrl(url);
  await AsyncStorage.setItem(API_URL_STORAGE_KEY, normalized);
  return normalized;
}
