import { useEffect, useRef, useState } from 'react';
import {
  loadYouTubeIframeApi,
  YOUTUBE_PLAYER_ENDED,
  type YouTubePlayerInstance,
} from '../lib/youtubeIframeApi';

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
  startSeconds?: number;
  endSeconds?: number;
  controls?: boolean;
  onEnded?: () => void;
}

interface PlayerFrameProps extends Omit<YouTubePlayerProps, 'className' | 'onEnded'> {
  loading?: 'eager' | 'lazy';
}

function playerParameters({ autoplay = false, startSeconds, endSeconds, controls = true }: PlayerFrameProps) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    playsinline: '1',
    origin: window.location.origin,
    controls: controls ? '1' : '0',
  });
  if (startSeconds != null && startSeconds > 0) params.set('start', String(Math.floor(startSeconds)));
  if (endSeconds != null && endSeconds > 0 && (startSeconds == null || endSeconds > startSeconds)) params.set('end', String(Math.floor(endSeconds)));
  return params;
}

function NativeYouTubeFrame({ videoId, title, autoplay = false, startSeconds, endSeconds, controls = true, loading }: PlayerFrameProps) {
  const params = playerParameters({ videoId, title, autoplay, startSeconds, endSeconds, controls });
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`}
      title={title}
      loading={loading ?? (autoplay ? 'eager' : 'lazy')}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}

function EventAwareYouTubePlayer({
  videoId,
  title,
  autoplay = false,
  startSeconds,
  endSeconds,
  controls = true,
  onEnded,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const endedHandlerRef = useRef(onEnded);
  const [playerUnavailable, setPlayerUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  endedHandlerRef.current = onEnded;

  useEffect(() => {
    let disposed = false;
    let player: YouTubePlayerInstance | null = null;
    setPlayerUnavailable(false);
    setReady(false);

    void loadYouTubeIframeApi()
      .then((api) => {
        if (disposed || !hostRef.current) return;
        const mount = document.createElement('div');
        hostRef.current.replaceChildren(mount);
        const playerVars: Record<string, string | number> = {
          autoplay: autoplay ? 1 : 0,
          controls: controls ? 1 : 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        };
        if (startSeconds != null && startSeconds > 0) playerVars.start = Math.floor(startSeconds);
        if (endSeconds != null && endSeconds > 0 && (startSeconds == null || endSeconds > startSeconds)) playerVars.end = Math.floor(endSeconds);
        player = new api.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars,
          events: {
            onReady: () => {
              if (!disposed) setReady(true);
            },
            onStateChange: (event) => {
              if (!disposed && event.data === YOUTUBE_PLAYER_ENDED) endedHandlerRef.current?.();
            },
            onError: () => {
              if (!disposed) setPlayerUnavailable(true);
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) setPlayerUnavailable(true);
      });

    return () => {
      disposed = true;
      try {
        player?.destroy();
      } catch {
        // YouTube may already have removed its iframe during navigation.
      }
    };
  }, [autoplay, controls, endSeconds, startSeconds, videoId]);

  return (
    <>
      <div ref={hostRef} hidden={playerUnavailable} />
      {playerUnavailable ? (
        <>
          <NativeYouTubeFrame videoId={videoId} title={title} autoplay={autoplay} startSeconds={startSeconds} endSeconds={endSeconds} controls={controls} loading="eager" />
          <span className="youtube-player__notice" role="status">Automatic next-video playback is unavailable for this upload. Use Next when it finishes.</span>
        </>
      ) : !ready ? <span className="youtube-player__loading" role="status">Preparing playback…</span> : null}
    </>
  );
}

/**
 * Privacy-enhanced YouTube embed. Catalogue previews remain lightweight; active
 * service playback opts into YouTube's event API so it can detect a true finish.
 */
export function YouTubePlayer(props: YouTubePlayerProps) {
  const { className, onEnded } = props;
  return (
    <div className={`youtube-player ${onEnded ? 'is-event-aware' : ''} ${className ?? ''}`.trim()}>
      {onEnded
        ? <EventAwareYouTubePlayer {...props} />
        : <NativeYouTubeFrame {...props} />}
    </div>
  );
}
