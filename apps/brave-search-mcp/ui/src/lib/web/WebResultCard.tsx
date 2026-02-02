/**
 * WebResultCard - Individual search result in classic Google-style layout with context selection
 */
import type { WebResultItem } from './types';
import { Check, Globe, Plus } from '@openai/apps-sdk-ui/components/Icon';
import { useMemo } from 'react';
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

  const descriptionNodes = useMemo(() => {
    if (!item.description)
      return null;
    if (typeof window === 'undefined')
      return stripHtml(item.description);

    const sanitized = sanitizeHtml(item.description);
    if (!sanitized)
      return null;

    const container = document.createElement('div');
    container.innerHTML = sanitized;

    const toReactNode = (node: ChildNode, key: string): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE)
        return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE)
        return null;

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'br')
        return <br key={key} />;

      const allowedTags = new Set(['strong', 'em', 'b', 'i', 'u', 'mark', 'span', 'p']);
      if (!allowedTags.has(tagName))
        return element.textContent;

      const Tag = (tagName === 'p' ? 'span' : tagName) as React.ElementType;
      const children = Array.from(element.childNodes).map((child, index) => (
        toReactNode(child, `${key}-${index}`)
      ));
      return <Tag key={key}>{children}</Tag>;
    };

    return Array.from(container.childNodes).map((node, index) =>
      toReactNode(node, `desc-${index}`),
    );
  }, [item.description]);

  return (
    <article className="web-result-shell">
      <button
        type="button"
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
                <Globe width={16} height={16} className="web-result-favicon-placeholder" />
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

        {/* Description - render sanitized HTML as React nodes to preserve highlights */}
        <div className="web-result-description">{descriptionNodes}</div>
      </button>

      {/* Context toggle button */}
      {onToggleContext && (
        <button
          type="button"
          className={`context-btn ${isInContext ? 'context-btn--active' : ''}`}
          onClick={handleContextToggle}
          aria-label={isInContext ? 'Remove from context' : 'Add to context'}
          title={isInContext ? 'In context' : 'Add to context'}
        >
          {isInContext ? <Check width={16} height={16} /> : <Plus width={16} height={16} />}
        </button>
      )}
    </article>
  );
}
