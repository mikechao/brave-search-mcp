/**
 * LocalMap - Leaflet map component with business markers
 */
import type { LocalBusinessItem } from './types';
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

// Create numbered markers
function createNumberedIcon(number: number, isSelected: boolean) {
  return L.divIcon({
    className: `local-map-marker ${isSelected ? 'local-map-marker--selected' : ''}`,
    html: `<div class="local-map-marker-inner">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface MapBoundsUpdaterProps {
  items: LocalBusinessItem[];
}

function MapBoundsUpdater({ items }: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    const coords = items
      .filter(item => item.coordinates)
      .map(item => item.coordinates as [number, number]);

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [items, map]);

  return null;
}

/**
 * Fix for Leaflet not rendering properly in dynamically-sized iframes.
 * Invalidates map size after mount and periodically to ensure tiles load.
 */
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after a short delay
    const timeouts = [0, 100, 300, 500, 1000].map(delay =>
      setTimeout(() => {
        map.invalidateSize();
      }, delay),
    );

    // Also listen for window resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

interface LocalMapProps {
  items: LocalBusinessItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
}

export function LocalMap({ items, selectedIndex, onSelectIndex }: LocalMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Calculate center and bounds
  const { center, hasCoordinates } = useMemo(() => {
    const coords = items
      .filter(item => item.coordinates)
      .map(item => item.coordinates as [number, number]);

    if (coords.length === 0) {
      return { center: [37.7749, -122.4194] as [number, number], hasCoordinates: false };
    }

    // Calculate center as average of all points
    const avgLat = coords.reduce((sum, [lat]) => sum + lat, 0) / coords.length;
    const avgLng = coords.reduce((sum, [, lng]) => sum + lng, 0) / coords.length;

    return { center: [avgLat, avgLng] as [number, number], hasCoordinates: true };
  }, [items]);

  if (!hasCoordinates) {
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
      <MapBoundsUpdater items={items} />
      <MapResizeHandler />

      {items.map((item, index) => {
        if (!item.coordinates)
          return null;
        const [lat, lng] = item.coordinates;
        const isSelected = selectedIndex === index;

        return (
          <Marker
            key={item.id || index}
            position={[lat, lng]}
            icon={createNumberedIcon(index + 1, isSelected)}
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
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
