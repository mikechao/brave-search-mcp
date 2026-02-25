import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './video.css';
import VideoChatGPTMode from './video-chatgpt-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoChatGPTMode />
  </StrictMode>,
);
