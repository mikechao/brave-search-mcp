import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WebMcpMode from './web-mcp-mode.tsx';
import '../../global.css';
import './web.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebMcpMode />
  </StrictMode>,
);
