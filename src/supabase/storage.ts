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
  return {
    async getItem(key) {
      return await SecureStore.getItemAsync(key);
    },
    async setItem(key, value) {
      await SecureStore.setItemAsync(key, value);
    },
    async removeItem(key) {
      await SecureStore.deleteItemAsync(key);
    },
  };
}

export const supabaseAuthStorage: StorageLike =
  Platform.OS === 'web' ? getWebStorage() : getSecureStore();

