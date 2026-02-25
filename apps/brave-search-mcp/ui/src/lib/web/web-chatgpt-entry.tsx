import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WebChatGPTMode from './web-chatgpt-mode.tsx';
import '../../global.css';
import './web.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebChatGPTMode />
  </StrictMode>,
);
