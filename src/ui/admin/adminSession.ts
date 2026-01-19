import * as SecureStore from 'expo-secure-store';

const KEY = 'fta.admin.authed.v1';

let authed = false;
let hydratePromise: Promise<boolean> | null = null;

export function isAdminAuthed() {
  return authed;
}

export async function hydrateAdminSession() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const stored = await SecureStore.getItemAsync(KEY);
      authed = stored === 'true';
      return authed;
    })();
  }
  return hydratePromise;
}

export async function setAdminAuthed(next: boolean) {
  authed = next;
  if (next) {
    await SecureStore.setItemAsync(KEY, 'true');
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}

