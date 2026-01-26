/**
 * Fetch geographic boundary polygon using Nominatim lookup API
 * Returns GeoJSON polygon coordinates or null if not found
 */
export async function fetchLocationBoundary(locationName: string): Promise<number[][][] | null> {
  try {
    // Clean up location name - remove trailing "UK" if present
    let cleanName = locationName.trim();
    cleanName = cleanName.replace(/\s+uk\s*$/i, '').trim();
    
    // Build search queries to try
    const queries: string[] = [];
    
    // Try different query formats
    queries.push(cleanName); // Just the name
    queries.push(`${cleanName}, England, UK`); // With country
    queries.push(`${cleanName}, United Kingdom`); // Alternative format
    
    // For specific location types, add appropriate suffixes
    const lowerName = cleanName.toLowerCase();
    if (lowerName.includes('london')) {
      if (!lowerName.includes('greater') && !lowerName.includes('borough')) {
        // For London sub-regions, try to find the area/district
        queries.push(`${cleanName} area, Greater London, UK`);
        queries.push(`${cleanName} district, Greater London, UK`);
        queries.push(`${cleanName}, Greater London, UK`);
        // Also try without "Greater London" to get the sub-region directly
        queries.push(`${cleanName}, London, UK`);
      }
    } else if (lowerName.includes('essex') || lowerName.includes('kent') || 
               lowerName.includes('surrey') || lowerName.includes('sussex')) {
      queries.push(`${cleanName} County, UK`);
      queries.push(`${cleanName}, England, UK`);
    }
    
    console.log(`Trying queries for: "${cleanName}"`);
    
    // Try each query until we find a boundary
    for (const query of queries) {
      const encodedQuery = encodeURIComponent(query);
      
      // Use Nominatim search with polygon_geojson=1
      // Increase limit to get more results and find the right administrative boundary
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=geojson&polygon_geojson=1&limit=10&addressdetails=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'FTA-App/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Score and sort features to prefer administrative boundaries
        const scoredFeatures = data.features
          .map((feature: any) => {
            let score = 0;
            const props = feature.properties || {};
            const geom = feature.geometry;
            
            // Must have geometry
            if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
              return { feature, score: -1 };
            }
            
            // Prefer administrative boundaries
            if (props.class === 'boundary' || props.class === 'place') {
              score += 50;
            }
            
            // Prefer higher administrative levels (lower numbers = higher level)
            if (props.admin_level) {
              const adminLevel = parseInt(props.admin_level, 10);
              // UK admin levels: 2=country, 4=region, 6=county, 8=district, 9=borough
              // Prefer counties (6) and districts (8) over smaller areas
              if (adminLevel <= 8) {
                score += 30 - adminLevel; // Higher score for lower admin level
              }
            }
            
            // Prefer specific administrative types
            const type = (props.type || '').toLowerCase();
            if (type.includes('county') || type.includes('district') || 
                type.includes('borough') || type.includes('region') ||
                type.includes('suburb') || type.includes('area')) {
              score += 40;
            }
            
            // For London sub-regions, prefer "suburb" or "area" types
            if (type === 'suburb' || type === 'area') {
              score += 20; // Additional boost for suburbs/areas
            }
            
            // Prefer larger polygons (more points = larger area typically)
            if (geom.type === 'Polygon' && geom.coordinates[0]) {
              score += Math.min(geom.coordinates[0].length / 100, 20); // Up to 20 points
            } else if (geom.type === 'MultiPolygon' && geom.coordinates[0]?.[0]) {
              score += Math.min(geom.coordinates[0][0].length / 100, 20);
            }
            
            // Penalize points of interest
            if (props.class === 'amenity' || props.class === 'shop' || 
                props.class === 'tourism' || props.class === 'leisure') {
              score -= 100; // Heavily penalize POIs
            }
            
            return { feature, score };
          })
          .filter((item: any) => item.score >= 0) // Remove features without geometry
          .sort((a: any, b: any) => b.score - a.score); // Sort by score descending
        
        console.log(`Scored ${scoredFeatures.length} features for "${query}"`);
        
        // Log top 3 features for debugging
        scoredFeatures.slice(0, 3).forEach((item: any, idx: number) => {
          const f = item.feature;
          const p = f.properties || {};
          console.log(`  ${idx + 1}. Score: ${item.score}, Type: ${p.type || 'unknown'}, Class: ${p.class || 'unknown'}, Name: ${p.name || p.display_name || 'unknown'}`);
        });
        
        // Try the highest scored features first
        for (const { feature, score } of scoredFeatures) {
          if (feature.geometry) {
            if (feature.geometry.type === 'Polygon') {
              const pointCount = feature.geometry.coordinates[0]?.length || 0;
              const props = feature.properties || {};
              console.log(`Using Polygon for "${query}" (score: ${score}, ${pointCount} points, type: ${props.type || 'unknown'}, class: ${props.class || 'unknown'})`);
              return feature.geometry.coordinates;
            } else if (feature.geometry.type === 'MultiPolygon') {
              const props = feature.properties || {};
              console.log(`Using MultiPolygon for "${query}" (score: ${score}, type: ${props.type || 'unknown'})`);
              return feature.geometry.coordinates[0];
            }
          }
        }
        
        // If no polygon in GeoJSON, try to get it from the relation/way details
        // But only for administrative boundaries
        const bestFeature = scoredFeatures[0]?.feature || data.features[0];
        if (bestFeature?.properties?.osm_id && bestFeature?.properties?.osm_type) {
          const props = bestFeature.properties;
          // Only try details API for boundaries/places, not POIs
          if (props.class === 'boundary' || props.class === 'place' || 
              props.type?.includes('county') || props.type?.includes('district') ||
              props.type?.includes('borough')) {
            const boundary = await fetchBoundaryFromOSMId(
              props.osm_type,
              props.osm_id
            );
            if (boundary) {
              return boundary;
            }
          }
        }
      }
    }

    console.log(`No boundary found for "${cleanName}" after trying ${queries.length} queries`);
    return null;
  } catch (error) {
    console.warn('Failed to fetch location boundary:', error);
    return null;
  }
}

/**
 * Fetch boundary from OSM ID using Nominatim details API
 */
async function fetchBoundaryFromOSMId(osmType: string, osmId: number): Promise<number[][][] | null> {
  try {
    const detailsUrl = `https://nominatim.openstreetmap.org/details.php?osmtype=${osmType}&osmid=${osmId}&format=geojson&polygon_geojson=1`;
    const response = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'FTA-App/1.0',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.geometry) {
        if (data.geometry.type === 'Polygon') {
          console.log(`Found Polygon from OSM details with ${data.geometry.coordinates[0]?.length || 0} points`);
          return data.geometry.coordinates;
        } else if (data.geometry.type === 'MultiPolygon') {
          console.log(`Found MultiPolygon from OSM details`);
          return data.geometry.coordinates[0];
        }
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch boundary from OSM ID:', error);
    return null;
  }
}

