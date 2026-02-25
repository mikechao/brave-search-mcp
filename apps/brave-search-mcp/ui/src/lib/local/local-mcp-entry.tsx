import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LocalMcpMode from './local-mcp-mode.tsx';
import '../../global.css';
import './local.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalMcpMode />
  </StrictMode>,
);
