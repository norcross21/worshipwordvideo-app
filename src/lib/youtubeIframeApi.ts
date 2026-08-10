export interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

export interface YouTubePlayerEvent {
  target: YouTubePlayerInstance;
}

export interface YouTubeStateChangeEvent extends YouTubePlayerEvent {
  data: number;
}

export interface YouTubePlayerOptions {
  videoId: string;
  host?: string;
  playerVars: Record<string, string | number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onError?: () => void;
    onStateChange?: (event: YouTubeStateChangeEvent) => void;
  };
}

export interface YouTubeIframeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_PLAYER_ENDED = 0;
let youtubeIframeApiPromise: Promise<YouTubeIframeApi> | null = null;

/** Load YouTube's player API once and share it between playback and trim tools. */
export function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise<YouTubeIframeApi>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('The interactive YouTube player took too long to load.')), 12_000);
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player controls did not become available.'));
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-worship-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.worshipYoutubeApi = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('The interactive YouTube player could not be loaded.'));
    }, { once: true });
  }).catch((error: unknown) => {
    youtubeIframeApiPromise = null;
    throw error;
  });

  return youtubeIframeApiPromise;
}

export function safeYouTubePlayerValue(read: () => number, fallback = 0): number {
  try {
    const value = read();
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}
