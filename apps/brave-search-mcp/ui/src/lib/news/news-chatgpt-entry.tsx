import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import NewsChatGPTMode from './news-chatgpt-mode.tsx';
import '../../global.css';
import './news.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewsChatGPTMode />
  </StrictMode>,
);
