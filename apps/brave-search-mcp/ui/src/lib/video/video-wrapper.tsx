/**
 * Video Search UI - App Wrapper with Runtime Detection
 * Supports both MCP-APP (ext-apps) and ChatGPT (OpenAI Apps SDK)
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useRuntimeMode } from '../../hooks/useRuntimeMode';
import '../../global.css';
import './video.css';

// Dynamic imports - only load the mode we actually need
const VideoMcpAppMode = lazy(() => import('./video-mcp-mode.tsx'));
const VideoChatGPTMode = lazy(() => import('./video-chatgpt-mode.tsx'));

function VideoAppWrapper() {
  const mode = useRuntimeMode('Video');

  if (mode === 'detecting') {
    return <div className="loading">Detecting runtime...</div>;
  }

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      {mode === 'chatgpt' ? <VideoChatGPTMode /> : <VideoMcpAppMode />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoAppWrapper />
  </StrictMode>,
);
