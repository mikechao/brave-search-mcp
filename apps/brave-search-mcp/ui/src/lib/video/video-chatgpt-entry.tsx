import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import VideoChatGPTMode from './video-chatgpt-mode.tsx';
import '../../global.css';
import './video.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoChatGPTMode />
  </StrictMode>,
);
