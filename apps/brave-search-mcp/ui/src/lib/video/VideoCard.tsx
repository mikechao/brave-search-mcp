/**
 * VideoCard component - Individual video result card
 */
import type { VideoItem } from './types';
import { Play } from 'lucide-react';

interface VideoCardProps {
  item: VideoItem;
  index: number;
  onPlay: (item: VideoItem) => void;
  onOpenLink: (url: string) => void;
}

export function VideoCard({ item, index, onPlay, onOpenLink }: VideoCardProps) {
  const isEmbeddable = Boolean(item.embedId);

  const handleClick = () => {
    if (isEmbeddable) {
      onPlay(item);
    }
    else {
      onOpenLink(item.url);
    }
  };

  return (
    <button
      className={`video-card ${isEmbeddable ? 'video-card--embeddable' : ''}`}
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
                <Play size={32} />
              </div>
            )}

        {/* Duration badge */}
        {item.duration && (
          <span className="video-duration">{item.duration}</span>
        )}

        {/* Play overlay */}
        <div className="video-play-overlay">
          <div className={`video-play-button ${isEmbeddable ? 'video-play-button--youtube' : ''}`}>
            <Play size={24} fill="currentColor" />
          </div>
        </div>

        {/* Embed badge */}
        {isEmbeddable && (
          <span className="video-embed-badge">
            {item.embedType === 'youtube' ? 'YouTube' : 'Vimeo'}
          </span>
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
