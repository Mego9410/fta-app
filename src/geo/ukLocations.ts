export type LatLng = { latitude: number; longitude: number };

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(u\.?\s*k\.?)\b/g, ' uk ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Approximate city/county centroids (good enough for “radius” filtering + map pin thumbnails).
const COORDS: Record<string, LatLng> = {
  // Country-level fallbacks
  uk: { latitude: 54.5, longitude: -3.0 },
  'united kingdom': { latitude: 54.5, longitude: -3.0 },
  england: { latitude: 52.85, longitude: -1.85 },
  scotland: { latitude: 56.4907, longitude: -4.2026 },
  wales: { latitude: 52.1307, longitude: -3.7837 },
  'northern ireland': { latitude: 54.65, longitude: -6.8 },
  'isle of man': { latitude: 54.2361, longitude: -4.5481 },
  jersey: { latitude: 49.2144, longitude: -2.1313 },
  guernsey: { latitude: 49.4657, longitude: -2.5853 },
  'channel islands': { latitude: 49.45, longitude: -2.55 },

  // Major cities
  london: { latitude: 51.5074, longitude: -0.1278 },
  birmingham: { latitude: 52.4862, longitude: -1.8904 },
  manchester: { latitude: 53.4808, longitude: -2.2426 },
  liverpool: { latitude: 53.4084, longitude: -2.9916 },
  leeds: { latitude: 53.8008, longitude: -1.5491 },
  bristol: { latitude: 51.4545, longitude: -2.5879 },
  cardiff: { latitude: 51.4816, longitude: -3.1791 },
  glasgow: { latitude: 55.8642, longitude: -4.2518 },
  edinburgh: { latitude: 55.9533, longitude: -3.1883 },
  newcastle: { latitude: 54.9783, longitude: -1.6178 },
  nottingham: { latitude: 52.9548, longitude: -1.1581 },
  sheffield: { latitude: 53.3811, longitude: -1.4701 },
  leicester: { latitude: 52.6369, longitude: -1.1398 },
  oxford: { latitude: 51.7520, longitude: -1.2577 },
  cambridge: { latitude: 52.2053, longitude: 0.1218 },
  brighton: { latitude: 50.8225, longitude: -0.1372 },
  reading: { latitude: 51.4543, longitude: -0.9781 },
  belfast: { latitude: 54.5973, longitude: -5.9301 },
  leicester: { latitude: 52.6369, longitude: -1.1398 },
  york: { latitude: 53.9590, longitude: -1.0815 },
  norwich: { latitude: 52.6309, longitude: 1.2974 },

  // London sub-regions (all point at London but help matching)
  'central london': { latitude: 51.5074, longitude: -0.1278 },
  'north london': { latitude: 51.5580, longitude: -0.1278 },
  'south london': { latitude: 51.4545, longitude: -0.1278 },
  'east london': { latitude: 51.5150, longitude: 0.0450 },
  'west london': { latitude: 51.5100, longitude: -0.2700 },
  'north west london': { latitude: 51.5520, longitude: -0.2400 },
  'north east london': { latitude: 51.5500, longitude: -0.0600 },
  'south east london': { latitude: 51.4500, longitude: 0.0200 },
  'south west london': { latitude: 51.4500, longitude: -0.2200 },
  'greater london': { latitude: 51.5074, longitude: -0.1278 },

  // Counties / regions commonly used on listings
  surrey: { latitude: 51.2710, longitude: -0.3410 },
  kent: { latitude: 51.2787, longitude: 0.5217 },
  essex: { latitude: 51.7356, longitude: 0.4685 },
  'west sussex': { latitude: 50.9280, longitude: -0.4610 },
  'east sussex': { latitude: 50.9086, longitude: 0.2494 },
  sussex: { latitude: 50.9086, longitude: 0.0000 },
  hampshire: { latitude: 51.0577, longitude: -1.3081 },
  dorset: { latitude: 50.7488, longitude: -2.3440 },
  somerset: { latitude: 51.1051, longitude: -2.9262 },
  devon: { latitude: 50.7156, longitude: -3.5309 },
  cornwall: { latitude: 50.2660, longitude: -5.0527 },
  berkshire: { latitude: 51.4543, longitude: -0.9781 },
  buckinghamshire: { latitude: 51.8072, longitude: -0.8120 },
  bedfordshire: { latitude: 52.1359, longitude: -0.4667 },
  hertfordshire: { latitude: 51.8098, longitude: -0.2377 },
  northamptonshire: { latitude: 52.2720, longitude: -0.8756 },
  warwickshire: { latitude: 52.2819, longitude: -1.5830 },
  staffordshire: { latitude: 52.8063, longitude: -2.1166 },
  cheshire: { latitude: 53.2326, longitude: -2.6103 },
  lancashire: { latitude: 53.7632, longitude: -2.7044 },
  merseyside: { latitude: 53.4167, longitude: -2.9167 },
  cumbria: { latitude: 54.5772, longitude: -2.7975 },
  'west midlands': { latitude: 52.4862, longitude: -1.8904 },
  'east midlands': { latitude: 52.9550, longitude: -1.1500 },
  'east of england': { latitude: 52.35, longitude: 0.45 },
  'west of england': { latitude: 51.25, longitude: -2.75 },
  yorkshire: { latitude: 53.8, longitude: -1.3 },
  'yorkshire and the humber': { latitude: 53.8, longitude: -1.3 },
  'east anglia': { latitude: 52.45, longitude: 1.0 },
  norfolk: { latitude: 52.6309, longitude: 1.2974 },
  'home counties': { latitude: 51.35, longitude: -0.4 },
  'south east': { latitude: 51.2000, longitude: 0.8000 },
  'south west': { latitude: 50.8000, longitude: -3.6000 },
  'north west': { latitude: 53.6000, longitude: -2.6000 },
  'north east': { latitude: 54.9, longitude: -1.6 },
  'north wales': { latitude: 53.2000, longitude: -3.9000 },
};

const ALIASES: Record<string, string> = {
  uk: 'uk',
  'united kingdom': 'united kingdom',
  'u k': 'uk',
  'great britain': 'uk',
  britain: 'uk',
  gb: 'uk',
  'united kingdom uk': 'uk',

  // Common region shorthands used by the FTA dataset.
  east: 'east of england',
  'east of england': 'east of england',
  'east england': 'east of england',
  'east anglia': 'east anglia',
  'west of england': 'west of england',
  'home counties': 'home counties',
  yorkshire: 'yorkshire',
  'yorkshire & the humber': 'yorkshire and the humber',
  'yorks and humber': 'yorkshire and the humber',

  ni: 'northern ireland',
  'n ireland': 'northern ireland',
  'northern ireland': 'northern ireland',
  'channel islands': 'channel islands',
  jersey: 'jersey',
  guernsey: 'guernsey',
  'isle of man': 'isle of man',

  'central london': 'central london',
  'south east london': 'south east london',
  'south east': 'south east',
  'south west': 'south west',
  'north west': 'north west',
  'north east': 'north east',
  'west midlands': 'west midlands',
  'east midlands': 'east midlands',
  'greater london': 'greater london',
  'nw london': 'north west london',
  'ne london': 'north east london',
  'se london': 'south east london',
  'sw london': 'south west london',
  'w london': 'west london',
  'e london': 'east london',
  'n london': 'north london',
  's london': 'south london',
  'tyne and wear': 'newcastle',
};

function containsWholePhrase(haystackNormalized: string, needleNormalized: string): boolean {
  return (` ${haystackNormalized} `).includes(` ${needleNormalized} `);
}

export function lookupUkLocation(input: string): LatLng | null {
  const normalized = normalizeKey(input);
  if (!normalized) return null;

  const aliasKey = ALIASES[normalized] ?? normalized;
  if (COORDS[aliasKey]) return COORDS[aliasKey];

  // Fuzzy contains match: prefer longest matching key, but only on whole-phrase matches
  // to avoid surprises like mapping "East" to an unrelated sub-region.
  let bestKey: string | null = null;
  for (const key of Object.keys(COORDS)) {
    if (containsWholePhrase(normalized, key)) {
      if (!bestKey || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey) return COORDS[bestKey];

  // Split on common separators and retry (e.g. "Central London, UK").
  const parts = input
    .split(/[,/•|-]+/g)
    .map((p) => normalizeKey(p))
    .filter(Boolean);
  for (const p of parts) {
    const aliased = ALIASES[p] ?? p;
    if (COORDS[aliased]) return COORDS[aliased];
    for (const key of Object.keys(COORDS)) {
      if (containsWholePhrase(p, key)) {
        if (!bestKey || key.length > bestKey.length) bestKey = key;
      }
    }
    if (bestKey) return COORDS[bestKey];
  }

  return null;
}

