export function getOsmStaticMapUrl(options: {
  latitude: number;
  longitude: number;
  width?: number;
  height?: number;
  zoom?: number;
  provider?: 'de' | 'fr' | 'rest';
  markerStyle?: 'plain' | 'red-pushpin';
}): string {
  const maxSize = options.provider === 'rest' ? 640 : 1024;
  const desiredW = Math.max(100, Math.round(options.width ?? 900));
  const desiredH = Math.max(100, Math.round(options.height ?? 520));
  const scale = Math.min(1, maxSize / desiredW, maxSize / desiredH);
  const width = Math.max(100, Math.min(maxSize, Math.round(desiredW * scale)));
  const height = Math.max(100, Math.min(maxSize, Math.round(desiredH * scale)));
  const zoom = Math.max(3, Math.min(18, Math.round(options.zoom ?? 10)));

  const lat = Number(Math.max(-90, Math.min(90, options.latitude)).toFixed(6));
  const lon = Number(Math.max(-180, Math.min(180, options.longitude)).toFixed(6));

  const markerStyle = options.markerStyle ?? 'plain';
  const marker =
    options.provider === 'rest'
      ? markerStyle === 'red-pushpin'
        ? `color:red|${lat},${lon}`
        : `${lat},${lon}`
      : markerStyle === 'red-pushpin'
        ? `${lat},${lon},red-pushpin`
        : `${lat},${lon}`;

  // Avoid relying on URLSearchParams (not consistently available across RN/web runtimes).
  const params: Record<string, string> = {
    center: `${lat},${lon}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    markers: marker,
  };
  if (options.provider === 'rest') {
    // Increase sharpness on modern screens without exceeding size limits.
    params.scale = '2';
  }
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const base = (() => {
    if (options.provider === 'rest') return 'https://static.maps.rest/osm';
    if (options.provider === 'fr') return 'https://staticmap.openstreetmap.fr/osmfr/staticmap.php';
    return 'https://staticmap.openstreetmap.de/staticmap.php';
  })();
  return `${base}?${query}`;
}

export function getOsmStaticMapUrlCandidates(options: {
  latitude: number;
  longitude: number;
  width?: number;
  height?: number;
  zoom?: number;
}): string[] {
  return [
    // Most compatible first, then provider fallbacks.
    getOsmStaticMapUrl({ ...options, provider: 'rest', markerStyle: 'red-pushpin' }),
    getOsmStaticMapUrl({ ...options, provider: 'rest', markerStyle: 'plain' }),
    getOsmStaticMapUrl({ ...options, provider: 'de', markerStyle: 'plain' }),
    getOsmStaticMapUrl({ ...options, provider: 'de', markerStyle: 'red-pushpin' }),
    getOsmStaticMapUrl({ ...options, provider: 'fr', markerStyle: 'plain' }),
    getOsmStaticMapUrl({ ...options, provider: 'fr', markerStyle: 'red-pushpin' }),
  ];
}

