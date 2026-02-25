import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './web.css';
import WebChatGPTMode from './web-chatgpt-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebChatGPTMode />
  </StrictMode>,
);
