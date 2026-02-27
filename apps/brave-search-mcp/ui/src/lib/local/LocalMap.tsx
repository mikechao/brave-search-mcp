/**
 * LocalMap - pigeon-maps component with business markers and persistent context pins
 */
import type { ContextPlace, LocalBusinessItem } from './types';
import { Map, Marker, Overlay } from 'pigeon-maps';
import { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

const EMPTY_CONTEXT_PLACES: ContextPlace[] = [];

/**
 * Calculate center and zoom level to fit a set of coordinates into view.
 * Uses standard OSM tile math: at zoom Z, width covers 360/2^Z degrees.
 * Assumes ~600px map width and adds 1 level of padding.
 */
function fitBoundsToCoords(coords: [number, number][]): { center: [number, number]; zoom: number } {
  if (coords.length === 0)
    return { center: [37.7749, -122.4194], zoom: 11 };
  if (coords.length === 1)
    return { center: coords[0], zoom: 14 };

  const lats = coords.map(([lat]) => lat);
  const lngs = coords.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  const latSpan = maxLat - minLat || 0.005;
  const lngSpan = maxLng - minLng || 0.005;

  // Approx map size 600×400 px; use the more constrained axis
  const zoomLng = Math.log2(600 / 256 * 360 / lngSpan);
  const zoomLat = Math.log2(400 / 256 * 180 / latSpan);
  const zoom = Math.min(15, Math.max(1, Math.floor(Math.min(zoomLng, zoomLat)) - 1));

  return { center, zoom };
}

interface MapState {
  openPopupKey: string | null;
}

type MapAction
  = | { type: 'openPopup'; key: string }
    | { type: 'closePopup' };

function mapReducer(_state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'openPopup':
      return { openPopupKey: action.key };
    case 'closePopup':
      return { openPopupKey: null };
  }
}

interface LocalMapProps {
  items: LocalBusinessItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  displayMode?: string;
  contextPlaces?: ContextPlace[];
}

export function LocalMap({ items, selectedIndex, onSelectIndex, contextPlaces = EMPTY_CONTEXT_PLACES }: LocalMapProps) {
  const [{ openPopupKey }, dispatch] = useReducer(mapReducer, { openPopupKey: null });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (!containerRef.current)
      return;

    // Fallback synchronous measurement for initial render if ResizeObserver is late
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && !dimensions) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions((prev) => {
            // Avoid unnecessary re-renders if dimensions are very similar (e.g. 0.Xpx difference)
            if (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) {
              return prev;
            }
            return { width, height };
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [dimensions]);

  const itemKeySet = useMemo(() => {
    return new Set(items.map(item => `${item.name}-${item.address}`));
  }, [items]);

  // Context places that are NOT on the current page (need separate markers)
  const offPageContextPlaces = useMemo(() => {
    return contextPlaces.filter(p => p.coordinates && !itemKeySet.has(`${p.name}-${p.address}`));
  }, [contextPlaces, itemKeySet]);

  const allCoords = useMemo(() => {
    const coords: [number, number][] = [];
    for (const item of items) {
      if (item.coordinates)
        coords.push(item.coordinates);
    }
    for (const p of offPageContextPlaces) {
      if (p.coordinates)
        coords.push(p.coordinates);
    }
    return coords;
  }, [items, offPageContextPlaces]);

  const initialFit = useMemo(() => fitBoundsToCoords(allCoords), [allCoords]);
  const coordsKey = allCoords.map(c => c.join(',')).join('|');

  const isInContext = (name: string, address: string) =>
    contextPlaces.some(p => `${p.name}-${p.address}` === `${name}-${address}`);

  if (allCoords.length === 0 && items.length === 0) {
    return (
      <div className="local-map-empty">
        <p>No location data available</p>
      </div>
    );
  }

  return (
    <div className="local-map-container" ref={containerRef}>
      {!!dimensions && (
        <Map
          key={coordsKey}
          width={dimensions.width}
          height={dimensions.height}
          defaultCenter={initialFit.center}
          defaultZoom={initialFit.zoom}
          onClick={() => dispatch({ type: 'closePopup' })}
        >
          {/* Current page items */}
          {items.flatMap((item, index) => {
            if (!item.coordinates)
              return [];
            const [lat, lng] = item.coordinates;
            const isSelected = selectedIndex === index;
            const inContext = isInContext(item.name, item.address);
            const popupKey = `current-${item.id ?? `${item.name}-${item.address}`}`;

            const marker = (
              <Marker
                key={`marker-${popupKey}`}
                anchor={[lat, lng]}
                onClick={() => {
                  onSelectIndex(index);
                  dispatch({ type: 'openPopup', key: popupKey });
                }}
              >
                <div className={[
                  'local-map-marker',
                  isSelected ? 'local-map-marker--selected' : '',
                  inContext ? 'local-map-marker--context' : '',
                ].filter(Boolean).join(' ')}
                >
                  <div className="local-map-marker-inner">{index + 1}</div>
                </div>
              </Marker>
            );

            const overlay = openPopupKey === popupKey
              ? (
                  <Overlay key={`overlay-${popupKey}`} anchor={[lat, lng]} offset={[0, 0]}>
                    <div className="local-map-popup local-map-popup--overlay">
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
                  </Overlay>
                )
              : null;

            return [marker, overlay];
          })}

          {/* Context places NOT on the current page */}
          {offPageContextPlaces.flatMap((place) => {
            if (!place.coordinates)
              return [];
            const [lat, lng] = place.coordinates;
            const popupKey = `context-${place.name}-${place.address}`;

            const marker = (
              <Marker
                key={`marker-${popupKey}`}
                anchor={[lat, lng]}
                onClick={() => dispatch({ type: 'openPopup', key: popupKey })}
              >
                <div className="local-map-marker local-map-marker--context-only">
                  <div className="local-map-marker-inner">✓</div>
                </div>
              </Marker>
            );

            const overlay = openPopupKey === popupKey
              ? (
                  <Overlay key={`overlay-${popupKey}`} anchor={[lat, lng]} offset={[0, 0]}>
                    <div className="local-map-popup local-map-popup--overlay">
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
                  </Overlay>
                )
              : null;

            return [marker, overlay];
          })}
        </Map>
      )}
    </div>
  );
}
