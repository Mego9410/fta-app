// Web-specific stub for db.ts - SQLite doesn't work on web
// This file is automatically used by Metro when Platform.OS === 'web'

export async function getMetaValue(_key: string): Promise<string | null> {
  return null;
}

export async function setMetaValue(_key: string, _value: string): Promise<void> {
  // No-op on web
}

export async function initDb(): Promise<void> {
  // No-op on web - database not available
}

export async function getDbHandle(): Promise<never> {
  throw new Error('Database not available on web platform');
}
