import { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { StaticTileMap } from './StaticTileMap';

export type InteractiveMapProps = {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  radiusMeters?: number;
  initialZoom?: number;
};

// Generate HTML for Leaflet.js map with circle overlay
function generateMapHTML(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  initialZoom: number,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      touch-action: none;
    }
    #map {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // Initialize map
    const map = L.map('map', {
      center: [${latitude}, ${longitude}],
      zoom: ${initialZoom},
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: false,
      keyboard: false,
      tap: false
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    // Add circle overlay showing the area extent
    const circle = L.circle([${latitude}, ${longitude}], {
      radius: ${radiusMeters},
      fillColor: 'rgba(225, 29, 72, 0.15)',
      fillOpacity: 0.15,
      color: 'rgba(225, 29, 72, 0.8)',
      weight: 2
    }).addTo(map);

    // Fit map to show the circle with padding
    map.fitBounds(circle.getBounds(), {
      padding: [20, 20]
    });

    // Prevent default touch behaviors that interfere with scrolling
    let touchStartDistance = 0;
    let touchStartTime = 0;
    
    map.getContainer().addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        touchStartDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartTime = Date.now();
      }
    }, { passive: true });

    // Disable text selection
    document.addEventListener('selectstart', function(e) {
      e.preventDefault();
      return false;
    });
  </script>
</body>
</html>
  `.trim();
}

export const InteractiveMap = memo(function InteractiveMap({
  latitude,
  longitude,
  width,
  height,
  radiusMeters = 5000, // Default 5km
  initialZoom = 12,
}: InteractiveMapProps) {
  const mapHTML = useMemo(
    () => generateMapHTML(latitude, longitude, radiusMeters, initialZoom),
    [latitude, longitude, radiusMeters, initialZoom],
  );

  // On web, fall back to static map since WebView might have issues
  if (Platform.OS === 'web') {
    return (
      <StaticTileMap
        latitude={latitude}
        longitude={longitude}
        width={width}
        height={height}
        zoom={initialZoom}
      />
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        source={{ html: mapHTML }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        // Allow pinch-to-zoom in the map
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
