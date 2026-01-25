/**
 * Web Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppTheme } from '../../hooks/useAppTheme';
import '../../global.css';
import './web.css';

// Dynamic imports - only load the mode we actually need
const WebMcpAppMode = lazy(() => import('./web-mcp-mode.tsx'));
const WebChatGPTMode = lazy(() => import('./web-chatgpt-mode.tsx'));

type RuntimeMode = 'detecting' | 'chatgpt' | 'mcp-app';

function WebAppWrapper() {
  useAppTheme();
  const [mode, setMode] = useState<RuntimeMode>('detecting');

  useEffect(() => {
    const checkIntervals = [0, 50, 100, 200, 500];
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const checkRuntime = () => {
      if (typeof window.openai !== 'undefined') {
        console.log('[Brave Web Widget] Detected ChatGPT runtime');
        setMode('chatgpt');
        return;
      }

      attempt++;
      if (attempt < checkIntervals.length) {
        timer = setTimeout(checkRuntime, checkIntervals[attempt]);
      }
      else {
        console.log('[Brave Web Widget] Using MCP-APP runtime');
        setMode('mcp-app');
      }
    };

    checkRuntime();

    return () => {
      if (timer)
        clearTimeout(timer);
    };
  }, []);

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
