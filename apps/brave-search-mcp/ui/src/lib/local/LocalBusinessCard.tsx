/**
 * LocalBusinessCard - Business listing card component with expandable details
 */
import type { LocalBusinessItem } from './types';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  MapsAddress,
  MapsDirections,
  Phone,
  Plus,
  Star,
} from '@openai/apps-sdk-ui/components/Icon';
import { lazy, Suspense } from 'react';

const LocalBusinessDescription = lazy(() => import('./LocalBusinessDescription'));

interface LocalBusinessCardProps {
  item: LocalBusinessItem;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onOpenLink: (url: string) => void;
  isInContext?: boolean;
  onToggleContext?: (item: LocalBusinessItem) => void;
}

export function LocalBusinessCard({
  item,
  index,
  isSelected,
  onSelect,
  onOpenLink,
  isInContext,
  onToggleContext,
}: LocalBusinessCardProps) {
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.phone) {
      onOpenLink(`tel:${item.phone}`);
    }
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.email) {
      onOpenLink(`mailto:${item.email}`);
    }
  };

  const handleDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.coordinates) {
      const [lat, lng] = item.coordinates;
      onOpenLink(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  };

  const handleContextToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleContext) {
      onToggleContext(item);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`local-card ${isSelected ? 'local-card--selected' : ''} ${isInContext ? 'local-card--in-context' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header row */}
      <div className="local-card-header">
        <button
          type="button"
          className="local-card-trigger"
          onClick={onSelect}
          aria-expanded={isSelected}
          aria-label={`${isSelected ? 'Collapse details for' : 'Expand details for'} ${item.name}`}
        >
          {/* Number badge */}
          <div className="local-card-number">{index + 1}</div>

          {/* Content */}
          <div className="local-card-content">
            <h3 className="local-card-name">{item.name}</h3>

            {/* Rating row */}
            <div className="local-card-rating">
              {item.rating !== undefined && (
                <>
                  <Star width={14} height={14} className="local-star" />
                  <span className="local-rating-value">{item.rating.toFixed(1)}</span>
                  {item.reviewCount && (
                    <span className="local-review-count">
                      (
                      {item.reviewCount}
                      )
                    </span>
                  )}
                </>
              )}
              {item.priceRange && (
                <span className="local-price">{item.priceRange}</span>
              )}
              {item.cuisine && item.cuisine.length > 0 && (
                <span className="local-cuisine">{item.cuisine.slice(0, 2).join(', ')}</span>
              )}
            </div>

            {/* Phone */}
            {item.phone && (
              <div className="local-card-phone">
                <Phone width={12} height={12} />
                <span>{item.phone}</span>
              </div>
            )}

            {/* Address */}
            <div className="local-card-address">
              <MapsAddress width={12} height={12} />
              <span>{item.address}</span>
            </div>

            {/* Hours */}
            {item.todayHours && (
              <div className="local-card-hours">
                <Clock width={12} height={12} />
                <span>
                  Today:
                  {item.todayHours}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Actions + Expand indicator */}
        <div className="local-card-actions">
          {item.phone && (
            <button className="local-action-btn" onClick={handleCall} title="Call">
              <Phone width={16} height={16} />
            </button>
          )}
          {item.coordinates && (
            <button className="local-action-btn" onClick={handleDirections} title="Directions">
              <MapsDirections width={16} height={16} />
            </button>
          )}
          {onToggleContext && (
            <button
              className={`local-action-btn local-context-btn ${isInContext ? 'local-context-btn--active' : ''}`}
              onClick={handleContextToggle}
              title={isInContext ? 'In context' : 'Add to context'}
            >
              {isInContext ? <Check width={16} height={16} /> : <Plus width={16} height={16} />}
            </button>
          )}
          <button
            type="button"
            className="local-action-btn local-expand-btn"
            onClick={handleToggleExpand}
            aria-expanded={isSelected}
            aria-label={isSelected ? 'Collapse details' : 'Expand details'}
            title={isSelected ? 'Collapse details' : 'Expand details'}
          >
            {isSelected ? <ChevronUp width={16} height={16} /> : <ChevronDown width={16} height={16} />}
          </button>
        </div>
      </div>

      {/* Expanded details section */}
      {isSelected && (
        <div className="local-card-details">
          {/* Email */}
          {item.email && (
            <div className="local-detail-row">
              <Mail width={14} height={14} />
              <button className="local-detail-link" onClick={handleEmail}>
                {item.email}
              </button>
            </div>
          )}

          {/* Weekly Hours */}
          {item.weeklyHours && (
            <div className="local-detail-section">
              <div className="local-detail-label">Hours</div>
              <pre className="local-weekly-hours">{item.weeklyHours}</pre>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="local-detail-section">
              <div className="local-detail-label">About</div>
              <div className="local-description">
                <Suspense fallback={<p>Loading details...</p>}>
                  <LocalBusinessDescription description={item.description} />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
