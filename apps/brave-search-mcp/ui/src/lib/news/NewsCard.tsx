/**
 * NewsCard component - Individual news article card
 */
import type { NewsItem } from './types';
import { Newspaper } from 'lucide-react';

interface NewsCardProps {
  item: NewsItem;
  index: number;
  onOpenLink: (url: string) => void;
}

export function NewsCard({ item, index, onOpenLink }: NewsCardProps) {
  const handleClick = () => {
    onOpenLink(item.url);
  };

  return (
    <button
      className={`news-card ${item.breaking ? 'news-card--breaking' : ''}`}
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
    </button>
  );
}
