import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getWebStorage(): StorageLike {
  return {
    async getItem(key) {
      try {
        return globalThis?.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      try {
        globalThis?.localStorage?.setItem(key, value);
      } catch {
        // ignore
      }
    },
    async removeItem(key) {
      try {
        globalThis?.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function getSecureStore(): StorageLike {
  const MAX_SECURESTORE_SIZE = 2048; // bytes - SecureStore has a 2048 byte limit
  
  return {
    async getItem(key) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error: any) {
        // SecureStore may fail if user interaction is not allowed (e.g., during background refresh)
        // Return null to allow Supabase to gracefully handle the missing session
        console.warn('SecureStore getItem failed, returning null:', error?.message);
        return null;
      }
    },
    async setItem(key, value) {
      try {
        // Check size before storing - SecureStore has a 2048 byte limit
        // Calculate UTF-8 byte length (more accurate than string length for multi-byte characters)
        const sizeInBytes = new TextEncoder().encode(value).length;
        if (sizeInBytes > MAX_SECURESTORE_SIZE) {
          console.warn(
            `SecureStore setItem: Value for key "${key}" is ${sizeInBytes} bytes, exceeding the 2048 byte limit. ` +
            'This may not be stored successfully. Consider using a different storage mechanism for large values.'
          );
        }
        await SecureStore.setItemAsync(key, value);
      } catch (error: any) {
        // SecureStore may fail if user interaction is not allowed (e.g., during background refresh)
        // or if the value is too large
        // Silently fail - the session will be saved on next successful interaction
        console.warn('SecureStore setItem failed:', error?.message);
      }
    },
    async removeItem(key) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error: any) {
        // SecureStore may fail if user interaction is not allowed (e.g., during background refresh)
        // Silently fail - cleanup will happen on next successful interaction
        console.warn('SecureStore removeItem failed:', error?.message);
      }
    },
  };
}

export const supabaseAuthStorage: StorageLike =
  Platform.OS === 'web' ? getWebStorage() : getSecureStore();

