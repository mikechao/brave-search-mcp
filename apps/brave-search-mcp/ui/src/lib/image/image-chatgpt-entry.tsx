import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './image.css';
import ImageChatGPTMode from './image-chatgpt-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageChatGPTMode />
  </StrictMode>,
);
