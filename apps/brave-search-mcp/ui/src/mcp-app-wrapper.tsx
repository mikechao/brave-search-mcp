/**
 * Brave Image Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 * 
 * IMPORTANT: Detection happens inside the component with a retry mechanism
 * because ChatGPT's skybridge may inject window.openai after initial script execution.
 */
import { StrictMode, Suspense, lazy, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';

// Dynamic imports - only load the mode we actually need
// This prevents ext-apps SDK from loading in ChatGPT mode
const McpAppMode = lazy(() => import('./mcp-app-mode.tsx'));
const ChatGPTMode = lazy(() => import('./chatgpt-mode.tsx'));

type RuntimeMode = 'detecting' | 'chatgpt' | 'mcp-app';

/**
 * Root wrapper with runtime detection
 * Uses a retry mechanism to detect ChatGPT's window.openai injection
 */
function AppWrapper() {
  const [mode, setMode] = useState<RuntimeMode>('detecting');

  useEffect(() => {
    // Check for window.openai multiple times with increasing delays
    // ChatGPT's skybridge may inject it after initial script execution
    const checkIntervals = [0, 50, 100, 200, 500];
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const checkRuntime = () => {
      if (typeof window.openai !== 'undefined') {
        console.log('[Brave Widget] Detected ChatGPT runtime');
        setMode('chatgpt');
        return;
      }

      attempt++;
      if (attempt < checkIntervals.length) {
        timer = setTimeout(checkRuntime, checkIntervals[attempt]);
      } else {
        // Fallback to MCP-APP mode if window.openai not found
        console.log('[Brave Widget] Using MCP-APP runtime');
        setMode('mcp-app');
      }
    };

    checkRuntime();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <ChatGPTMode /> : <McpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
);

// Re-export WidgetProps for backwards compatibility
export type { WidgetProps } from './widget-props.ts';
