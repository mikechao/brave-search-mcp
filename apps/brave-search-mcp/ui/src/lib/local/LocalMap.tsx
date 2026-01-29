/**
 * LocalMap - Leaflet map component with business markers and persistent context pins
 */
import type { ContextPlace, LocalBusinessItem } from './types';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in webpack/vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Create numbered markers for current page items
function createNumberedIcon(number: number, isSelected: boolean, isInContext: boolean) {
  const contextClass = isInContext ? 'local-map-marker--context' : '';
  return L.divIcon({
    className: `local-map-marker ${isSelected ? 'local-map-marker--selected' : ''} ${contextClass}`,
    html: `<div class="local-map-marker-inner">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Create context-only markers (for places not on current page but in context)
function createContextIcon() {
  return L.divIcon({
    className: 'local-map-marker local-map-marker--context-only',
    html: '<div class="local-map-marker-inner">✓</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface MapBoundsUpdaterProps {
  items: LocalBusinessItem[];
  contextPlaces: ContextPlace[];
}

function MapBoundsUpdater({ items, contextPlaces }: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    // Include both current page items and context places in bounds
    const itemCoords = items
      .filter(item => item.coordinates)
      .map(item => item.coordinates as [number, number]);

    const contextCoords = contextPlaces
      .filter(p => p.coordinates)
      .map(p => p.coordinates as [number, number]);

    const allCoords = [...itemCoords, ...contextCoords];

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [items, contextPlaces, map]);

  return null;
}

/**
 * Fix for Leaflet not rendering properly in dynamically-sized iframes.
 * Invalidates map size after mount and periodically to ensure tiles load.
 */
function MapResizeHandler({ displayMode }: { displayMode?: string }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after a short delay
    const timer0 = setTimeout(() => {
      map.invalidateSize();
    }, 0);
    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    const timer3 = setTimeout(() => {
      map.invalidateSize();
    }, 500);
    const timer4 = setTimeout(() => {
      map.invalidateSize();
    }, 1000);

    // Also listen for window resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  // Invalidate size when display mode changes (e.g., fullscreen toggle)
  useEffect(() => {
    if (!displayMode)
      return;

    // Delay to allow CSS transition to complete
    const timer0 = setTimeout(() => {
      map.invalidateSize();
    }, 0);
    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    const timer3 = setTimeout(() => {
      map.invalidateSize();
    }, 500);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [displayMode, map]);

  return null;
}

interface LocalMapProps {
  items: LocalBusinessItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  displayMode?: string;
  contextPlaces?: ContextPlace[];
}

export function LocalMap({ items, selectedIndex, onSelectIndex, displayMode, contextPlaces = [] }: LocalMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Helper to check if a place is in context
  const isInContext = (name: string, address: string) => {
    return contextPlaces.some(p => `${p.name}-${p.address}` === `${name}-${address}`);
  };

  const itemKeySet = useMemo(() => {
    return new Set(items.map(item => `${item.name}-${item.address}`));
  }, [items]);

  // Context places that are NOT on the current page (need separate markers)
  const offPageContextPlaces = useMemo(() => {
    return contextPlaces.filter(p => p.coordinates && !itemKeySet.has(`${p.name}-${p.address}`));
  }, [contextPlaces, itemKeySet]);

  // Calculate center and bounds
  const { center, hasCoordinates } = useMemo(() => {
    const itemCoords = items
      .filter(item => item.coordinates)
      .map(item => item.coordinates as [number, number]);

    const contextCoords = offPageContextPlaces
      .filter(p => p.coordinates)
      .map(p => p.coordinates as [number, number]);

    const allCoords = [...itemCoords, ...contextCoords];

    if (allCoords.length === 0) {
      return { center: [37.7749, -122.4194] as [number, number], hasCoordinates: false };
    }

    // Calculate center as average of all points
    const avgLat = allCoords.reduce((sum, [lat]) => sum + lat, 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, [, lng]) => sum + lng, 0) / allCoords.length;

    return { center: [avgLat, avgLng] as [number, number], hasCoordinates: true };
  }, [items, offPageContextPlaces]);

  if (!hasCoordinates && items.length === 0) {
    return (
      <div className="local-map-empty">
        <p>No location data available</p>
      </div>
    );
  }

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={13}
      className="local-map-container"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsUpdater items={items} contextPlaces={contextPlaces} />
      <MapResizeHandler displayMode={displayMode} />

      {/* Current page items */}
      {items.map((item, index) => {
        if (!item.coordinates)
          return null;
        const [lat, lng] = item.coordinates;
        const isSelected = selectedIndex === index;
        const inContext = isInContext(item.name, item.address);

        return (
          <Marker
            key={`current-${item.id ?? `${item.name}-${item.address}`}`}
            position={[lat, lng]}
            icon={createNumberedIcon(index + 1, isSelected, inContext)}
            eventHandlers={{
              click: () => onSelectIndex(index),
            }}
          >
            <Popup>
              <div className="local-map-popup">
                <strong>{item.name}</strong>
                {item.rating && (
                  <div>
                    ★
                    {item.rating.toFixed(1)}
                  </div>
                )}
                <div>{item.address}</div>
                {inContext && <div className="local-map-popup-context">✓ In context</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Context places that are NOT on the current page */}
      {offPageContextPlaces.map((place) => {
        if (!place.coordinates)
          return null;
        const [lat, lng] = place.coordinates;

        return (
          <Marker
            key={`context-${place.name}-${place.address}`}
            position={[lat, lng]}
            icon={createContextIcon()}
          >
            <Popup>
              <div className="local-map-popup">
                <strong>{place.name}</strong>
                {place.rating && (
                  <div>
                    ★
                    {place.rating.toFixed(1)}
                  </div>
                )}
                <div>{place.address}</div>
                <div className="local-map-popup-context">✓ In context</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
