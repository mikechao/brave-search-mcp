import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './image.css';
import ImageMcpMode from './image-mcp-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageMcpMode />
  </StrictMode>,
);
