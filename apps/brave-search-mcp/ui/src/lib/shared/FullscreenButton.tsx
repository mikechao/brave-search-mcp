/**
 * Fullscreen toggle button component
 * Works with both MCP-APP and ChatGPT hosts
 */
import { CollapseLarge, ExpandLarge } from '@openai/apps-sdk-ui/components/Icon';

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
      {isFullscreen
        ? (
          // Collapse icon
          <CollapseLarge width={16} height={16} />
          )
        : (
          // Expand icon
          <ExpandLarge width={16} height={16} />
          )}
    </button>
  );
}
