import { useEffect, useState } from 'react';
import { Maximize2, MonitorUp, X } from 'lucide-react';
import { readProjectionState, subscribeToProjectionState } from '../data/projection';
import { formatPlaybackTime } from '../data/worshipQueue';
import { YouTubePlayer } from './YouTubePlayer';

export function ProjectionScreen() {
  const [projection, setProjection] = useState(readProjectionState);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const item = projection.playingIndex == null ? null : projection.queue[projection.playingIndex] ?? null;

  useEffect(() => subscribeToProjectionState(setProjection), []);
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
    document.title = item ? `${item.title} · Projection` : 'Worship projection';
  }, [item?.title]);

  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* Browser keeps the button visible for a retry. */ }
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
          />
          <div className="projection-screen__caption">
            <strong>{item.title}</strong>
            {(item.startSeconds != null || item.endSeconds != null) && <span>{formatPlaybackTime(item.startSeconds) || '0:00'} → {formatPlaybackTime(item.endSeconds) || 'video end'}</span>}
          </div>
        </div>
      ) : (
        <div className="projection-screen__waiting">
          <MonitorUp size={52} />
          <h1>Church screen ready</h1>
          <ol>
            <li>Move this window onto the projector or second monitor if it is still on your dashboard.</li>
            <li>Press the Full screen button below.</li>
            <li>Return to the dashboard and choose Start the first video.</li>
          </ol>
          {!isFullscreen && <button type="button" className="projection-screen__fullscreen-primary" onClick={() => void enterFullscreen()}><Maximize2 size={19} /> Make this screen full screen</button>}
        </div>
      )}
      <div className="projection-screen__tools">
        {!isFullscreen && <button type="button" onClick={() => void enterFullscreen()}><Maximize2 size={17} /> Full screen</button>}
        <button type="button" onClick={() => window.close()}><X size={17} /> Close</button>
      </div>
    </main>
  );
}
