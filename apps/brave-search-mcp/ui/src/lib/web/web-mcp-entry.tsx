import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './web.css';
import WebMcpMode from './web-mcp-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebMcpMode />
  </StrictMode>,
);
