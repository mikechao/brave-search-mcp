import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './news.css';
import NewsMcpMode from './news-mcp-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsMcpMode />
  </StrictMode>,
);
