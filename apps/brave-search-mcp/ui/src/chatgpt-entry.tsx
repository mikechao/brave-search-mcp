/**
 * ChatGPT Entry Point
 * COMPLETELY STANDALONE - no ext-apps SDK imports at all
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ChatGPTMode from './chatgpt-mode.tsx';
import './global.css';


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ChatGPTMode />
    </StrictMode>,
);
