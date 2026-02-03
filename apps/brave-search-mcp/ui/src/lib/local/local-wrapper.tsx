/**
 * Local Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useRuntimeMode } from '../../hooks/useRuntimeMode';
import '../../global.css';
import './local.css';

// Dynamic imports - only load the mode we actually need
const LocalMcpAppMode = lazy(() => import('./local-mcp-mode.tsx'));
const LocalChatGPTMode = lazy(() => import('./local-chatgpt-mode.tsx'));

function LocalAppWrapper() {
  const mode = useRuntimeMode('Local');

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <LocalChatGPTMode /> : <LocalMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalAppWrapper />
  </StrictMode>,
);
