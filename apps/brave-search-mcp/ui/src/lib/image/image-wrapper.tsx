/**
 * Image Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useRuntimeMode } from '../../hooks/useRuntimeMode';
import '../../global.css';
import './image.css';

// Dynamic imports - only load the mode we actually need
const ImageMcpAppMode = lazy(() => import('./image-mcp-mode.tsx'));
const ImageChatGPTMode = lazy(() => import('./image-chatgpt-mode.tsx'));

function ImageAppWrapper() {
  useAppTheme();
  const mode = useRuntimeMode('Image');

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <ImageChatGPTMode /> : <ImageMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageAppWrapper />
  </StrictMode>,
);
