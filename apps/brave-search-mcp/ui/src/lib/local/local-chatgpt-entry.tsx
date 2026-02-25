import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LocalChatGPTMode from './local-chatgpt-mode.tsx';
import '../../global.css';
import './local.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalChatGPTMode />
  </StrictMode>,
);
