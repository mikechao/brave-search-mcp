/**
 * Video Embed Modal - Displays embedded YouTube/Vimeo player
 */
import type { VideoItem } from './types';
import { X } from '@openai/apps-sdk-ui/components/Icon';

interface VideoEmbedModalProps {
  video: VideoItem;
  onClose: () => void;
}

export function VideoEmbedModal({ video, onClose }: VideoEmbedModalProps) {
  if (!video.embedId || !video.embedType)
    return null;

  const embedUrl = video.embedType === 'youtube'
    ? `https://www.youtube.com/embed/${video.embedId}?autoplay=1`
    : `https://player.vimeo.com/video/${video.embedId}?autoplay=1`;

  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div className="video-modal" onClick={e => e.stopPropagation()}>
        <button className="video-modal-close" onClick={onClose}>
          <X width={24} height={24} />
        </button>
        <div className="video-modal-content">
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="video-modal-iframe"
          />
        </div>
        <div className="video-modal-title">{video.title}</div>
      </div>
    </div>
  );
}
