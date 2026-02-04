import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const OVERFLOW_PREFIX = 'supabase-auth-overflow:';
const MAX_SECURESTORE_SIZE = 2048; // bytes - SecureStore has a 2048 byte limit

function overflowKey(key: string) {
  return `${OVERFLOW_PREFIX}${key}`;
}

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
      try {
        const fromSecure = await SecureStore.getItemAsync(key);
        if (fromSecure !== null) return fromSecure;
        const fromOverflow = await AsyncStorage.getItem(overflowKey(key));
        return fromOverflow;
      } catch (error: any) {
        console.warn('SecureStore getItem failed, returning null:', error?.message);
        return null;
      }
    },
    async setItem(key, value) {
      const sizeInBytes = new TextEncoder().encode(value).length;
      const useOverflow = sizeInBytes > MAX_SECURESTORE_SIZE;
      try {
        if (useOverflow) {
          await SecureStore.deleteItemAsync(key).catch(() => {});
          await AsyncStorage.setItem(overflowKey(key), value);
        } else {
          await AsyncStorage.removeItem(overflowKey(key)).catch(() => {});
          await SecureStore.setItemAsync(key, value);
        }
      } catch (error: any) {
        console.warn('Auth storage setItem failed:', error?.message);
      }
    },
    async removeItem(key) {
      try {
        await SecureStore.deleteItemAsync(key);
        await AsyncStorage.removeItem(overflowKey(key));
      } catch (error: any) {
        console.warn('SecureStore removeItem failed:', error?.message);
      }
    },
  };
}

export const supabaseAuthStorage: StorageLike =
  Platform.OS === 'web' ? getWebStorage() : getSecureStore();

