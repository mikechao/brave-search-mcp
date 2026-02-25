import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../global.css';
import './news.css';
import NewsChatGPTMode from './news-chatgpt-mode.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsChatGPTMode />
  </StrictMode>,
);
