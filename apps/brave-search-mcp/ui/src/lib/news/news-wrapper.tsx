/**
 * News Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useRuntimeMode } from '../../hooks/useRuntimeMode';
import '../../global.css';
import './news.css';

// Dynamic imports - only load the mode we actually need
const NewsMcpAppMode = lazy(() => import('./news-mcp-mode.tsx'));
const NewsChatGPTMode = lazy(() => import('./news-chatgpt-mode.tsx'));

function NewsAppWrapper() {
  useAppTheme();
  const mode = useRuntimeMode('News');

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <NewsChatGPTMode /> : <NewsMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsAppWrapper />
  </StrictMode>,
);
