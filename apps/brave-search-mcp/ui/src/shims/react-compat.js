import * as PreactCompat from 'preact/compat';
import { useContext } from 'preact/hooks';

// React 19 introduced use(Context). react-leaflet@5 relies on it.
export function use(usable) {
  // eslint-disable-next-line react/no-use-context -- React 19 `use(Context)` compatibility shim for preact
  return useContext(usable);
}

export * from 'preact/compat';
export default PreactCompat;
