import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './video.css';
import VideoMcpMode from './video-mcp-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoMcpMode />
  </StrictMode>,
);
