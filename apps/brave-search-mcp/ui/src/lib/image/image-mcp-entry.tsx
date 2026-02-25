import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ImageMcpMode from './image-mcp-mode.tsx';
import '../../global.css';
import './image.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageMcpMode />
  </StrictMode>,
);
