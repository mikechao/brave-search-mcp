import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import VideoMcpMode from './video-mcp-mode.tsx';
import '../../global.css';
import './video.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoMcpMode />
  </StrictMode>,
);
