/**
 * Fullscreen toggle button component
 * Works with both MCP-APP and ChatGPT hosts
 */

interface FullscreenButtonProps {
    onRequestFullscreen: () => void;
    displayMode?: 'inline' | 'fullscreen' | 'pip';
}

export function FullscreenButton({ onRequestFullscreen, displayMode }: FullscreenButtonProps) {
    const isFullscreen = displayMode === 'fullscreen';

    return (
        <button
            className="fullscreen-btn"
            onClick={onRequestFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
            {isFullscreen ? (
                // Minimize icon
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
            ) : (
                // Maximize icon
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
            )}
        </button>
    );
}
