import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, MonitorUp, X } from 'lucide-react';
import {
  PROJECTION_HEARTBEAT_INTERVAL_MS,
  publishProjectionCommand,
  readProjectionState,
  subscribeToProjectionCommands,
  subscribeToProjectionState,
} from '../data/projection';
import { formatPlaybackTime } from '../data/worshipQueue';
import { YouTubePlayer } from './YouTubePlayer';

function placementFromUrl(): { left: number; top: number; width: number; height: number } | null {
  const parameters = new URLSearchParams(window.location.search);
  const values = ['left', 'top', 'width', 'height'].map((key) => Number(parameters.get(key)));
  return parameters.get('placed') === '1' && values.every(Number.isFinite)
    ? { left: values[0], top: values[1], width: values[2], height: values[3] }
    : null;
}

export function ProjectionScreen() {
  const [projection, setProjection] = useState(readProjectionState);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState('');
  const hadVideoRef = useRef(readProjectionState().playingIndex != null);
  const urlLaunchId = new URLSearchParams(window.location.search).get('launch') ?? '';
  const activeLaunchId = projection.launchId || urlLaunchId;
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;
  const itemTitle = item?.title;

  const enterFullscreen = useCallback(async (silent = false): Promise<boolean> => {
    if (document.fullscreenElement) return true;
    if (!document.fullscreenEnabled) {
      if (!silent) setFullscreenError('Page full screen is unavailable. The clean presentation window will remain maximised instead.');
      return false;
    }
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      setFullscreenError('');
      return true;
    } catch {
      if (!silent) setFullscreenError('Your browser requires a click before true full screen. The clean window is still ready to use.');
      return false;
    }
  }, []);

  useEffect(() => subscribeToProjectionState(setProjection), []);

  useEffect(() => subscribeToProjectionCommands((command) => {
    if (!activeLaunchId || command.launchId !== activeLaunchId || command.type !== 'close') return;
    publishProjectionCommand('closed', activeLaunchId);
    window.close();
  }), [activeLaunchId]);

  useEffect(() => {
    document.body.classList.add('projection-body');
    const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = robotsMeta?.content;
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => {
      document.body.classList.remove('projection-body');
      if (robotsMeta && previousRobots) robotsMeta.content = previousRobots;
      document.removeEventListener('fullscreenchange', updateFullscreen);
    };
  }, []);

  useEffect(() => {
    const placement = placementFromUrl();
    if (!placement) return;
    const place = () => {
      try {
        window.moveTo(placement.left, placement.top);
        window.resizeTo(placement.width, placement.height);
      } catch {
        // The opener already attempted placement; unsupported browsers keep the fallback window.
      }
    };
    place();
    const retry = window.setTimeout(place, 400);
    return () => window.clearTimeout(retry);
  }, []);

  useEffect(() => {
    if (!activeLaunchId) return;
    const announceReady = () => publishProjectionCommand('ready', activeLaunchId);
    const announceHeartbeat = () => publishProjectionCommand('heartbeat', activeLaunchId);
    announceReady();
    const heartbeat = window.setInterval(announceHeartbeat, PROJECTION_HEARTBEAT_INTERVAL_MS);
    window.addEventListener('focus', announceReady);
    window.addEventListener('pageshow', announceReady);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') announceReady();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', announceReady);
      window.removeEventListener('pageshow', announceReady);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeLaunchId]);

  useEffect(() => {
    document.title = itemTitle ? `${itemTitle} · Projection` : 'Worship projection';
  }, [itemTitle]);

  useEffect(() => {
    if (item) hadVideoRef.current = true;
  }, [item]);

  useEffect(() => {
    if (!item || projection.stopped || new URLSearchParams(window.location.search).get('placed') !== '1') return;
    void enterFullscreen(true);
  }, [enterFullscreen, item, projection.stopped]);

  const closeProjection = () => {
    publishProjectionCommand('closed', activeLaunchId);
    window.close();
  };

  return (
    <main className="projection-screen" aria-label="Church projection screen">
      {item && !projection.stopped ? (
        <div className="projection-screen__stage">
          <YouTubePlayer
            key={`${item.id}-${item.startSeconds ?? 0}-${item.endSeconds ?? 0}-${projection.playbackRevision}`}
            videoId={item.youtubeId}
            title={`${item.title} - ${item.artist}`}
            autoplay
            startSeconds={item.startSeconds}
            endSeconds={item.endSeconds}
            className="projection-screen__player"
            onEnded={() => publishProjectionCommand('ended', activeLaunchId, item.id)}
          />
          <div className="projection-screen__caption">
            <strong>{item.title}</strong>
            {(item.startSeconds != null || item.endSeconds != null) && <span>{formatPlaybackTime(item.startSeconds) || '0:00'} → {formatPlaybackTime(item.endSeconds) || 'video end'}</span>}
          </div>
        </div>
      ) : (
        <div className="projection-screen__waiting">
          <MonitorUp size={52} />
          <h1>{projection.stopped ? 'Video stopped' : hadVideoRef.current ? 'Service complete' : 'Church screen connected'}</h1>
          <p>{projection.stopped
            ? 'The church screen is ready. Choose Restart, Previous or Next on the private controller.'
            : hadVideoRef.current
              ? 'The final worship video has finished. Choose another video from the private controller whenever you are ready.'
              : 'Choose a video on the private controller. It will appear here automatically.'}</p>
          {!isFullscreen && (
            <button type="button" className="projection-screen__fullscreen-primary" onClick={() => void enterFullscreen()}>
              <Maximize2 size={22} /> Optional full screen
            </button>
          )}
          {fullscreenError && <div className="projection-screen__error" role="alert">{fullscreenError}</div>}
        </div>
      )}
      <div className="projection-screen__tools">
        {!isFullscreen && <button type="button" onClick={() => void enterFullscreen()}><Maximize2 size={17} /> Full screen</button>}
        <button type="button" onClick={closeProjection}><X size={17} /> Close</button>
      </div>
    </main>
  );
}
