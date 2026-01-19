import * as SQLite from 'expo-sqlite';

import { seedListings } from '@/src/data/seed';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('fta.db');
  }
  return dbPromise;
}

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return rows.length ? rows[0].value : null;
}

async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}

export async function getMetaValue(key: string): Promise<string | null> {
  return getMeta(key);
}

export async function setMetaValue(key: string, value: string) {
  await setMeta(key, value);
}

export async function initDb() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      featured INTEGER NOT NULL,

      tagsJson TEXT NOT NULL DEFAULT '[]',
      moreInfoUrl TEXT,

      title TEXT NOT NULL,
      industry TEXT NOT NULL,
      summary TEXT NOT NULL,

      locationCity TEXT NOT NULL,
      locationState TEXT NOT NULL,
      latitude REAL,
      longitude REAL,

      askingPrice INTEGER NOT NULL,
      grossRevenue INTEGER,
      cashFlow INTEGER,
      ebitda INTEGER,

      yearEstablished INTEGER,
      employeesRange TEXT,

      confidential INTEGER NOT NULL,
      financingAvailable INTEGER NOT NULL,

      photosJson TEXT NOT NULL,

      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(featured);

    CREATE TABLE IF NOT EXISTS favorites (
      listingId TEXT PRIMARY KEY NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(listingId) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      listingId TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      callbackWindow TEXT,
      message TEXT,

      industry TEXT,
      location TEXT,
      incomeMix TEXT,
      practiceType TEXT,
      surgeriesCount INTEGER,
      tenure TEXT,
      readiness TEXT,
      timeline TEXT,
      revenueRange TEXT,
      earningsRange TEXT,

      createdAt TEXT NOT NULL,
      FOREIGN KEY(listingId) REFERENCES listings(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);
    CREATE INDEX IF NOT EXISTS idx_leads_listingId ON leads(listingId);
  `);

  // Lightweight schema migration(s)
  const listingsCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(listings);');
  const hasTagsJson = listingsCols.some((c) => c.name === 'tagsJson');
  if (!hasTagsJson) {
    await db.execAsync(`ALTER TABLE listings ADD COLUMN tagsJson TEXT NOT NULL DEFAULT '[]';`);
  }
  const hasMoreInfoUrl = listingsCols.some((c) => c.name === 'moreInfoUrl');
  if (!hasMoreInfoUrl) {
    await db.execAsync(`ALTER TABLE listings ADD COLUMN moreInfoUrl TEXT;`);
  }
  const hasLatitude = listingsCols.some((c) => c.name === 'latitude');
  if (!hasLatitude) {
    await db.execAsync(`ALTER TABLE listings ADD COLUMN latitude REAL;`);
  }
  const hasLongitude = listingsCols.some((c) => c.name === 'longitude');
  if (!hasLongitude) {
    await db.execAsync(`ALTER TABLE listings ADD COLUMN longitude REAL;`);
  }

  const leadsCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(leads);');
  const hasCallbackWindow = leadsCols.some((c) => c.name === 'callbackWindow');
  if (!hasCallbackWindow) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN callbackWindow TEXT;`);
  }
  const hasIncomeMix = leadsCols.some((c) => c.name === 'incomeMix');
  if (!hasIncomeMix) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN incomeMix TEXT;`);
  }
  const hasPracticeType = leadsCols.some((c) => c.name === 'practiceType');
  if (!hasPracticeType) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN practiceType TEXT;`);
  }
  const hasSurgeriesCount = leadsCols.some((c) => c.name === 'surgeriesCount');
  if (!hasSurgeriesCount) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN surgeriesCount INTEGER;`);
  }
  const hasTenure = leadsCols.some((c) => c.name === 'tenure');
  if (!hasTenure) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN tenure TEXT;`);
  }
  const hasReadiness = leadsCols.some((c) => c.name === 'readiness');
  if (!hasReadiness) {
    await db.execAsync(`ALTER TABLE leads ADD COLUMN readiness TEXT;`);
  }

  // Seed once.
  const seedDone = await getMeta('seedDone');
  if (seedDone !== 'true') {
    const nowIso = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const listing of seedListings) {
        await db.runAsync(
          `INSERT OR IGNORE INTO listings(
            id, status, featured,
            tagsJson,
            moreInfoUrl,
            title, industry, summary,
            locationCity, locationState,
            askingPrice, grossRevenue, cashFlow, ebitda,
            yearEstablished, employeesRange,
            confidential, financingAvailable,
            photosJson,
            createdAt, updatedAt
          ) VALUES(
            ?, ?, ?,
            ?,
            ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?,
            ?, ?
          )`,
          [
            listing.id,
            listing.status,
            listing.featured ? 1 : 0,
            JSON.stringify(listing.tags ?? []),
            listing.moreInfoUrl ?? null,
            listing.title,
            listing.industry,
            listing.summary,
            listing.locationCity,
            listing.locationState,
            listing.askingPrice,
            listing.grossRevenue ?? null,
            listing.cashFlow ?? null,
            listing.ebitda ?? null,
            listing.yearEstablished ?? null,
            listing.employeesRange ?? null,
            listing.confidential ? 1 : 0,
            listing.financingAvailable ? 1 : 0,
            JSON.stringify(listing.photos ?? []),
            listing.createdAt ?? nowIso,
            listing.updatedAt ?? nowIso,
          ],
        );
      }
    });
    await setMeta('seedDone', 'true');
  }
}

export async function getDbHandle() {
  return getDb();
}

