/**
 * VideoPipView - Full-bleed video player for Picture-in-Picture mode
 * Renders the video iframe filling the PiP container
 * Host provides the close button, we handle the displayMode change
 */
import type { VideoItem } from './types';

interface VideoPipViewProps {
  video: VideoItem;
}

export function VideoPipView({ video }: VideoPipViewProps) {
  if (!video.embedId || !video.embedType)
    return null;

  const embedUrl = video.embedType === 'youtube'
    ? `https://www.youtube.com/embed/${video.embedId}?autoplay=1`
    : `https://player.vimeo.com/video/${video.embedId}?autoplay=1`;

  return (
    <div className="video-pip-container">
      <iframe
        src={embedUrl}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="video-pip-iframe"
      />
    </div>
  );
}
