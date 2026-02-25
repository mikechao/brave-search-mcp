import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ImageChatGPTMode from './image-chatgpt-mode.tsx';
import '../../global.css';
import './image.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageChatGPTMode />
  </StrictMode>,
);
