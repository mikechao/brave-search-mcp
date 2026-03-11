import type { ComponentType } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export function mountWidget(Widget: ComponentType) {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Expected #root element for widget mount');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <Widget />
    </StrictMode>,
  );
}
