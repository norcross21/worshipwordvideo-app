import { useEffect, useRef, useState } from 'react';
import { youtubeWatchUrl } from '../data/youtube';

type PlayerError = 2 | 5 | 100 | 101 | 150 | 153;

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
}

interface YouTubePlayerInstance {
  destroy: () => void;
}

interface YouTubePlayerEvent {
  data: PlayerError;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host: string;
      playerVars: Record<string, string | number>;
      events: { onError: (event: YouTubePlayerEvent) => void };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

function errorMessage(code: PlayerError): string {
  if (code === 100) return 'This video has been removed or made private.';
  if (code === 101 || code === 150) return 'The publisher only allows this video to play directly on YouTube.';
  if (code === 153) return 'YouTube could not verify this embedded player.';
  return 'This video could not be played here.';
}

export function YouTubePlayer({ videoId, title, autoplay = false, className }: YouTubePlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let player: YouTubePlayerInstance | null = null;
    let cancelled = false;
    setError('');

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      player = new YT.Player(mountRef.current, {
        videoId,
        host: 'https://www.youtube.com',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onError: (event) => setError(errorMessage(event.data)),
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [autoplay, videoId]);

  return (
    <div className={className}>
      <div ref={mountRef} title={title} />
      {error && (
        <div className="youtube-player__error" role="alert">
          <p>{error}</p>
          <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">Watch on YouTube</a>
        </div>
      )}
    </div>
  );
}
