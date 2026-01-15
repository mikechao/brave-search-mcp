/**
 * WebResultCard - Individual search result in classic Google-style layout
 */
import type { WebResultItem } from './types';
import { Globe } from 'lucide-react';

interface WebResultCardProps {
    item: WebResultItem;
    index: number;
    onOpenLink: (url: string) => void;
}

export function WebResultCard({ item, index, onOpenLink }: WebResultCardProps) {
    const handleClick = () => {
        onOpenLink(item.url);
    };

    return (
        <button
            className="web-result"
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

            {/* Title */}
            <h3 className="web-result-title">{item.title}</h3>

            {/* Description */}
            <p className="web-result-description">{item.description}</p>
        </button>
    );
}
