interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
  startSeconds?: number;
  endSeconds?: number;
  controls?: boolean;
}

/**
 * A small, privacy-enhanced YouTube embed. Using the native iframe keeps the
 * player stable between catalogue selections and avoids loading YouTube's
 * larger JavaScript player API before somebody actually presses play.
 */
export function YouTubePlayer({ videoId, title, autoplay = false, className, startSeconds, endSeconds, controls = true }: YouTubePlayerProps) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    playsinline: '1',
    origin: window.location.origin,
    controls: controls ? '1' : '0',
  });
  if (startSeconds != null && startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  if (endSeconds != null && endSeconds > 0 && (startSeconds == null || endSeconds > startSeconds)) params.set('end', String(Math.floor(endSeconds)));

  return (
    <div className={`youtube-player ${className ?? ''}`.trim()}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`}
        title={title}
        loading="eager"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
