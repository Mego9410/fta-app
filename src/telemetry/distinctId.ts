import * as SecureStore from 'expo-secure-store';

const KEY = 'fta.telemetry.distinctId.v1';

function makeId() {
  return `d_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export async function getDistinctId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing && existing.trim()) return existing.trim();
    const next = makeId();
    await SecureStore.setItemAsync(KEY, next);
    return next;
  } catch (error: any) {
    // SecureStore may fail if user interaction is not allowed (e.g., during background refresh)
    // Fall back to generating a new ID without persisting it
    console.warn('SecureStore access failed, using temporary ID:', error?.message);
    return makeId();
  }
}

