import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import NewsMcpMode from './news-mcp-mode.tsx';
import '../../global.css';
import './news.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsMcpMode />
  </StrictMode>,
);
