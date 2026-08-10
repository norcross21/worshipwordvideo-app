import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, MonitorUp, X } from 'lucide-react';
import {
  publishProjectionCommand,
  publishProjectionState,
  readProjectionState,
  subscribeToProjectionState,
} from '../data/projection';
import { formatPlaybackTime } from '../data/worshipQueue';
import { YouTubePlayer } from './YouTubePlayer';

export function ProjectionScreen() {
  const [projection, setProjection] = useState(readProjectionState);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [starting, setStarting] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [serviceStarted, setServiceStarted] = useState(() => readProjectionState().playingIndex != null);
  const autoAttemptedRef = useRef(false);
  const parameters = new URLSearchParams(window.location.search);
  const launchId = parameters.get('launch') ?? '';
  const wasPlaced = parameters.get('placed') === '1';
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;

  const startService = useCallback(() => {
    if (!projection.queue.length) return;
    const next = {
      ...projection,
      playingIndex: 0,
      playbackRevision: projection.playbackRevision + 1,
      updatedAt: Date.now(),
    };
    setProjection(next);
    setServiceStarted(true);
    publishProjectionCommand('start', launchId);
  }, [launchId, projection]);

  const enterFullscreen = useCallback(async (silent = false): Promise<boolean> => {
    if (document.fullscreenElement) return true;
    if (!document.fullscreenEnabled) {
      if (!silent) setFullscreenError('This browser does not offer page full screen. The clean presentation window will remain maximised instead.');
      return false;
    }
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      setFullscreenError('');
      return true;
    } catch {
      if (!silent) setFullscreenError('Full screen was blocked. Click the button once more or use your browser’s full-screen command.');
      return false;
    }
  }, []);

  const enterFullscreenAndStart = async () => {
    setStarting(true);
    await enterFullscreen();
    startService();
    setStarting(false);
  };

  useEffect(() => subscribeToProjectionState(setProjection), []);
  useEffect(() => {
    document.body.classList.add('projection-body');
    const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = robotsMeta?.content;
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const announceClose = () => {
      publishProjectionState({ queue: [], playingIndex: null, playbackRevision: Date.now() });
      publishProjectionCommand('closed', launchId);
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    window.addEventListener('beforeunload', announceClose);
    return () => {
      document.body.classList.remove('projection-body');
      if (robotsMeta && previousRobots) robotsMeta.content = previousRobots;
      document.removeEventListener('fullscreenchange', updateFullscreen);
      window.removeEventListener('beforeunload', announceClose);
    };
  }, [launchId]);
  useEffect(() => {
    document.title = item ? `${item.title} · Projection` : 'Worship projection';
  }, [item?.title]);
  useEffect(() => {
    if (item) setServiceStarted(true);
  }, [item]);
  useEffect(() => {
    if (autoAttemptedRef.current || item) return;
    autoAttemptedRef.current = true;
    void enterFullscreen(true).then((entered) => {
      if (entered) startService();
    });
  }, [enterFullscreen, item, startService]);

  const closeProjection = () => {
    publishProjectionState({ queue: [], playingIndex: null, playbackRevision: Date.now() });
    publishProjectionCommand('closed', launchId);
    window.close();
  };

  return (
    <main className="projection-screen" aria-label="Church projection screen">
      {item ? (
        <div className="projection-screen__stage">
          <YouTubePlayer
            key={`${item.id}-${item.startSeconds ?? 0}-${item.endSeconds ?? 0}-${projection.playbackRevision}`}
            videoId={item.youtubeId}
            title={`${item.title} - ${item.artist}`}
            autoplay
            startSeconds={item.startSeconds}
            endSeconds={item.endSeconds}
            className="projection-screen__player"
            onEnded={() => publishProjectionCommand('ended', launchId, item.id)}
          />
          <div className="projection-screen__caption">
            <strong>{item.title}</strong>
            {(item.startSeconds != null || item.endSeconds != null) && <span>{formatPlaybackTime(item.startSeconds) || '0:00'} → {formatPlaybackTime(item.endSeconds) || 'video end'}</span>}
          </div>
        </div>
      ) : (
        <div className="projection-screen__waiting">
          <MonitorUp size={52} />
          <h1>{serviceStarted ? 'Service complete' : 'Church screen ready'}</h1>
          <p>{serviceStarted
            ? 'The final worship video has finished. The service controls remain private on the main computer.'
            : wasPlaced
              ? 'One final confirmation keeps the browser secure. The service starts immediately after this screen enters full screen.'
              : 'Place this clean window on the church display if needed. The service starts immediately after full screen opens.'}</p>
          {!serviceStarted && !isFullscreen && (
            <button type="button" autoFocus className="projection-screen__fullscreen-primary" onClick={() => void enterFullscreenAndStart()} disabled={starting}>
              <Maximize2 size={22} /> {starting ? 'Starting presentation…' : 'Full screen and start'}
            </button>
          )}
          {!serviceStarted && <small>Press Enter to use the highlighted button.</small>}
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
