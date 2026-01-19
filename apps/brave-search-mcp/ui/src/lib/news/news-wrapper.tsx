/**
 * News Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './news.css';

// Dynamic imports - only load the mode we actually need
const NewsMcpAppMode = lazy(() => import('./news-mcp-mode.tsx'));
const NewsChatGPTMode = lazy(() => import('./news-chatgpt-mode.tsx'));

type RuntimeMode = 'detecting' | 'chatgpt' | 'mcp-app';

function NewsAppWrapper() {
  const [mode, setMode] = useState<RuntimeMode>('detecting');

  useEffect(() => {
    const checkIntervals = [0, 50, 100, 200, 500];
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const checkRuntime = () => {
      if (typeof window.openai !== 'undefined') {
        console.log('[Brave News Widget] Detected ChatGPT runtime');
        setMode('chatgpt');
        return;
      }

      attempt++;
      if (attempt < checkIntervals.length) {
        timer = setTimeout(checkRuntime, checkIntervals[attempt]);
      }
      else {
        console.log('[Brave News Widget] Using MCP-APP runtime');
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
      {mode === 'chatgpt' ? <NewsChatGPTMode /> : <NewsMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsAppWrapper />
  </StrictMode>,
);
