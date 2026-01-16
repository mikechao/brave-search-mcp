/**
 * LocalBusinessCard - Business listing card component with expandable details
 */
import type { LocalBusinessItem } from './types';
import { ChevronDown, ChevronUp, Clock, Mail, MapPin, Phone, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface LocalBusinessCardProps {
    item: LocalBusinessItem;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    onOpenLink: (url: string) => void;
}

export function LocalBusinessCard({
    item,
    index,
    isSelected,
    onSelect,
    onOpenLink,
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

    return (
        <div
            className={`local-card ${isSelected ? 'local-card--selected' : ''}`}
            onClick={onSelect}
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Header row */}
            <div className="local-card-header">
                {/* Number badge */}
                <div className="local-card-number">{index + 1}</div>

                {/* Content */}
                <div className="local-card-content">
                    <h3 className="local-card-name">{item.name}</h3>

                    {/* Rating row */}
                    <div className="local-card-rating">
                        {item.rating !== undefined && (
                            <>
                                <Star size={14} fill="currentColor" className="local-star" />
                                <span className="local-rating-value">{item.rating.toFixed(1)}</span>
                                {item.reviewCount && (
                                    <span className="local-review-count">({item.reviewCount})</span>
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
                            <Phone size={12} />
                            <span>{item.phone}</span>
                        </div>
                    )}

                    {/* Address */}
                    <div className="local-card-address">
                        <MapPin size={12} />
                        <span>{item.address}</span>
                    </div>

                    {/* Hours */}
                    {item.todayHours && (
                        <div className="local-card-hours">
                            <Clock size={12} />
                            <span>Today: {item.todayHours}</span>
                        </div>
                    )}
                </div>

                {/* Actions + Expand indicator */}
                <div className="local-card-actions">
                    {item.phone && (
                        <button className="local-action-btn" onClick={handleCall} title="Call">
                            <Phone size={16} />
                        </button>
                    )}
                    {item.coordinates && (
                        <button className="local-action-btn" onClick={handleDirections} title="Directions">
                            <MapPin size={16} />
                        </button>
                    )}
                    <div className="local-expand-icon">
                        {isSelected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>
            </div>

            {/* Expanded details section */}
            {isSelected && (
                <div className="local-card-details">
                    {/* Email */}
                    {item.email && (
                        <div className="local-detail-row">
                            <Mail size={14} />
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
                                <ReactMarkdown>{item.description}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
