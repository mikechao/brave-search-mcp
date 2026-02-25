import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './local.css';
import LocalMcpMode from './local-mcp-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalMcpMode />
  </StrictMode>,
);
