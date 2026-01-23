/**
 * NewsCard component - Individual news article card with context selection
 */
import type { NewsItem } from './types';
import { Check, Newspaper, Plus } from 'lucide-react';

interface NewsCardProps {
  item: NewsItem;
  index: number;
  onOpenLink: (url: string) => void;
  isInContext?: boolean;
  onToggleContext?: (item: NewsItem) => void;
}

export function NewsCard({ item, index, onOpenLink, isInContext, onToggleContext }: NewsCardProps) {
  const handleClick = () => {
    onOpenLink(item.url);
  };

  const handleContextToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleContext) {
      onToggleContext(item);
    }
  };

  return (
    <button
      className={`news-card ${item.breaking ? 'news-card--breaking' : ''} ${isInContext ? 'news-card--in-context' : ''}`}
      onClick={handleClick}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="news-thumbnail">
        {item.thumbnail?.src
          ? (
              <img
                src={item.thumbnail.src}
                alt=""
                className="news-thumbnail-img"
                loading="lazy"
              />
            )
          : (
              <div className="news-placeholder">
                <Newspaper size={24} />
              </div>
            )}
      </div>
      <div className="news-content">
        <div className="news-header">
          <span className="news-source">
            {item.favicon && (
              <img src={item.favicon} alt="" className="news-favicon" />
            )}
            {item.source}
          </span>
          <span className="news-age">{item.age}</span>
          {item.breaking && <span className="news-breaking-badge">BREAKING</span>}
        </div>
        <h3 className="news-title">{item.title}</h3>
        <p className="news-description">{item.description}</p>
      </div>
      {onToggleContext && (
        <button
          type="button"
          className={`context-btn ${isInContext ? 'context-btn--active' : ''}`}
          onClick={handleContextToggle}
          aria-label={isInContext ? 'Remove from context' : 'Add to context'}
          title={isInContext ? 'In context' : 'Add to context'}
        >
          {isInContext ? <Check size={16} /> : <Plus size={16} />}
        </button>
      )}
    </button>
  );
}
