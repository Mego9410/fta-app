import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export type StaticTileMapProps = {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  zoom?: number;
};

type Tile = { x: number; y: number; left: number; top: number; url: string };

const TILE_SIZE = 256;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function latLonToWorldPx(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const z = clamp(Math.round(zoom), 1, 19);
  const n = 2 ** z;
  const latRad = (clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180;
  const x = ((lon + 180) / 360) * n * TILE_SIZE;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
  return { x, y };
}

function makeTiles(options: {
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
}): Tile[] {
  const zoom = clamp(Math.round(options.zoom), 1, 19);
  const sizeW = Math.max(1, Math.round(options.width));
  const sizeH = Math.max(1, Math.round(options.height));

  const { x: centerX, y: centerY } = latLonToWorldPx(options.latitude, options.longitude, zoom);
  const topLeftX = centerX - sizeW / 2;
  const topLeftY = centerY - sizeH / 2;

  const x0 = Math.floor(topLeftX / TILE_SIZE);
  const y0 = Math.floor(topLeftY / TILE_SIZE);
  const x1 = Math.floor((topLeftX + sizeW - 1) / TILE_SIZE);
  const y1 = Math.floor((topLeftY + sizeH - 1) / TILE_SIZE);

  const n = 2 ** zoom;
  const tiles: Tile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue; // outside WebMercator tile bounds
    for (let tx = x0; tx <= x1; tx++) {
      const wrappedX = ((tx % n) + n) % n; // wrap world horizontally
      const left = Math.round(tx * TILE_SIZE - topLeftX);
      const top = Math.round(ty * TILE_SIZE - topLeftY);
      // Use one canonical subdomain to avoid mixed caching behavior.
      const url = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`;
      tiles.push({ x: wrappedX, y: ty, left, top, url });
    }
  }

  // Keep this bounded for perf (especially in lists).
  return tiles.slice(0, 12);
}

export const StaticTileMap = memo(function StaticTileMap(props: StaticTileMapProps) {
  const zoom = props.zoom ?? 10;

  const tiles = useMemo(
    () =>
      makeTiles({
        latitude: props.latitude,
        longitude: props.longitude,
        zoom,
        width: props.width,
        height: props.height,
      }),
    [props.height, props.latitude, props.longitude, props.width, zoom],
  );

  return (
    <View style={[styles.root, { width: props.width, height: props.height }]}>
      {tiles.map((t) => (
        <Image
          key={`${t.x}-${t.y}-${t.left}-${t.top}`}
          source={{ uri: t.url }}
          style={[styles.tile, { left: t.left, top: t.top }]}
          fadeDuration={0}
        />
      ))}
      <View pointerEvents="none" style={[styles.pin, { left: props.width / 2, top: props.height / 2 }]} />
      <View pointerEvents="none" style={[styles.pinInner, { left: props.width / 2, top: props.height / 2 }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  pin: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  pinInner: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
    backgroundColor: '#e11d48',
  },
});

