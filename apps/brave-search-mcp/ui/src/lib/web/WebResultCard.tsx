/**
 * WebResultCard - Individual search result in classic Google-style layout with context selection
 */
import type { WebResultItem } from './types';
import { Check, Globe, Plus } from 'lucide-react';
import { sanitizeHtml, stripHtml } from '../shared/sanitize';

interface WebResultCardProps {
  item: WebResultItem;
  index: number;
  onOpenLink: (url: string) => void;
  isInContext?: boolean;
  onToggleContext?: (item: WebResultItem) => void;
}

export function WebResultCard({ item, index, onOpenLink, isInContext, onToggleContext }: WebResultCardProps) {
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
      className={`web-result ${isInContext ? 'web-result--in-context' : ''}`}
      onClick={handleClick}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* URL line with favicon */}
      <div className="web-result-url-line">
        {item.favicon
          ? (
              <img
                src={item.favicon}
                alt=""
                className="web-result-favicon"
                width={16}
                height={16}
              />
            )
          : (
              <Globe size={16} className="web-result-favicon-placeholder" />
            )}
        <span className="web-result-domain">{item.domain}</span>
        {item.age && (
          <>
            <span className="web-result-dot">•</span>
            <span className="web-result-age">{item.age}</span>
          </>
        )}
      </div>

      {/* Title - strip HTML since we don't want formatting in titles */}
      <h3 className="web-result-title">{stripHtml(item.title)}</h3>

      {/* Description - render sanitized HTML to preserve <strong> highlights */}
      <p
        className="web-result-description"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
      />

      {/* Context toggle button */}
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
