/**
 * VideoCard component - Individual video result card with context selection
 */
import type { VideoItem } from './types';
import { Check, Play, Plus } from '@openai/apps-sdk-ui/components/Icon';

interface VideoCardProps {
  item: VideoItem;
  index: number;
  onPlay: (item: VideoItem) => void;
  onOpenLink: (url: string) => void;
  isInContext?: boolean;
  onToggleContext?: (item: VideoItem) => void;
}

export function VideoCard({ item, index, onPlay, onOpenLink, isInContext, onToggleContext }: VideoCardProps) {
  const isEmbeddable = Boolean(item.embedId);

  const handleClick = () => {
    if (isEmbeddable) {
      onPlay(item);
    }
    else {
      onOpenLink(item.url);
    }
  };

  const handleContextToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleContext) {
      onToggleContext(item);
    }
  };

  return (
    <button
      className={`video-card ${isEmbeddable ? 'video-card--embeddable' : ''} ${isInContext ? 'video-card--in-context' : ''}`}
      onClick={handleClick}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Thumbnail with play overlay */}
      <div className="video-thumbnail">
        {item.thumbnail?.src
          ? (
              <img
                src={item.thumbnail.src}
                alt={item.title}
                className="video-thumbnail-image"
                loading="lazy"
              />
            )
          : (
              <div className="video-placeholder">
                <Play width={32} height={32} />
              </div>
            )}

        {/* Duration badge */}
        {item.duration && (
          <span className="video-duration">{item.duration}</span>
        )}

        {/* Play overlay */}
        <div className="video-play-overlay">
          <div className={`video-play-button ${isEmbeddable ? 'video-play-button--youtube' : ''}`}>
            <Play width={24} height={24} />
          </div>
        </div>

        {/* Embed badge */}
        {isEmbeddable && (
          <span className="video-embed-badge">
            {item.embedType === 'youtube' ? 'YouTube' : 'Vimeo'}
          </span>
        )}

        {/* Context button - top right of thumbnail */}
        {onToggleContext && (
          <button
            type="button"
            className={`context-btn ${isInContext ? 'context-btn--active' : ''}`}
            onClick={handleContextToggle}
            aria-label={isInContext ? 'Remove from context' : 'Add to context'}
            title={isInContext ? 'In context' : 'Add to context'}
          >
            {isInContext ? <Check width={14} height={14} /> : <Plus width={14} height={14} />}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="video-content">
        <h3 className="video-title">{item.title}</h3>

        <div className="video-meta">
          {item.favicon && (
            <img
              src={item.favicon}
              alt=""
              className="video-favicon"
              width={16}
              height={16}
            />
          )}
          <span className="video-creator">{item.creator}</span>
        </div>

        <div className="video-stats">
          {item.views && <span>{item.views}</span>}
          {item.views && item.age && <span className="video-stats-dot">•</span>}
          {item.age && <span>{item.age}</span>}
        </div>
      </div>
    </button>
  );
}
