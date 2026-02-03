/**
 * Web Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useRuntimeMode } from '../../hooks/useRuntimeMode';
import '../../global.css';
import './web.css';

// Dynamic imports - only load the mode we actually need
const WebMcpAppMode = lazy(() => import('./web-mcp-mode.tsx'));
const WebChatGPTMode = lazy(() => import('./web-chatgpt-mode.tsx'));

function WebAppWrapper() {
  const mode = useRuntimeMode('Web');

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <WebChatGPTMode /> : <WebMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebAppWrapper />
  </StrictMode>,
);
