import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './local.css';
import LocalChatGPTMode from './local-chatgpt-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalChatGPTMode />
  </StrictMode>,
);
